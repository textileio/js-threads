import toJsonSchema from 'to-json-schema'
import cbor from 'cbor-sync'
import { Service, Client } from '@textile/threads-service'
import { EventEmitter2 } from 'eventemitter2'
import { Dispatcher, Entity, DomainDatastore, Event, Update, Op } from '@textile/threads-store'
import { Datastore, MemoryDatastore, Key } from 'interface-datastore'
import { ThreadID, ThreadRecord, Multiaddr, ThreadInfo } from '@textile/threads-core'
import { EventBus } from './eventbus'
import { Collection, JSONSchema } from './collection'
import { createThread, decodeRecord, Cache } from './utils'

const metaKey = new Key('meta')
const schemaKey = metaKey.child(new Key('schema'))
const duplicateCollection = new Error('Duplicate collection')

export type Options = {
  dispatcher?: Dispatcher
  eventBus?: EventBus
  service?: Service
}

export class Database {
  /**
   * ThreadID is the id for the thread to use for this
   */
  public threadID?: ThreadID
  /**
   * Collections is a map of collections (database tables)
   */
  public collections: Map<string, Collection> = new Map()
  /**
   * Service is the networking layer
   */
  public service: Service
  /**
   * EventBus is used to marshal events to and from a Threads service
   */
  public eventBus: EventBus
  /**
   * Dispatcher is used to dispatch local events from producers to reducers (collections)
   */
  public dispatcher: Dispatcher

  /**
   * Child is the primary datastore, and is used to partition out stores as sub-domains
   */
  public child: DomainDatastore<any>

  public emitter: EventEmitter2 = new EventEmitter2({ wildcard: true })

  /**
   * Database creates a new database using the provided thread.
   * @param datastore The primary datastore, and is used to partition out stores as sub-domains.
   * @param options A set of database options.
   */
  constructor(datastore: Datastore<any> = new MemoryDatastore<any>(), options: Options = {}) {
    this.child = new DomainDatastore(datastore, new Key('db'))
    this.dispatcher =
      options.dispatcher ?? new Dispatcher(new DomainDatastore(datastore, new Key('dispatcher')))
    this.service =
      options.service ??
      new Service(new DomainDatastore(datastore, new Key('service')), new Client())
    this.eventBus =
      options.eventBus ??
      new EventBus(new DomainDatastore(this.child, new Key('eventbus')), this.service)
  }

  /**
   * fromAddress creates a new database from a thread hosted by another peer.
   * @param address The address for the thread with which to connect.
   * Should be of the form /ip4/<url/ip-address>/tcp/<port>/p2p/<peer-id>/thread/<thread-id>
   * @param replicatorKey Symmetric key. Uint8Array or base58-encoded string of length 44 bytes.
   * @param readKey Symmetric key. Uint8Array or base58-encoded string of length 44 bytes.
   * @param datastore The primary datastore, and is used to partition out stores as sub-domains.
   * @param options A set of database options.
   */
  static async fromAddress(
    addr: Multiaddr,
    replicatorKey?: Uint8Array,
    readKey?: Uint8Array,
    datastore: Datastore<any> = new MemoryDatastore<any>(),
    options: Options = {},
  ) {
    const db = new Database(datastore, options)
    const info = await db.service.addThread(addr, { replicatorKey, readKey })
    await db.open(info.id)
    db.service.pullThread(info.id) // Don't await
    return db
  }

  @Cache()
  async ownLogInfo() {
    return this.threadID && this.service.getOwnLog(this.threadID, false)
  }

  /**
   * newCollectionFromObject creates a new collection from an initial input object.
   * It will attempt to infer the JSON schema from the input object.
   * @param name A name for the collection.
   * @param data A valid JSON object.
   */
  newCollectionFromObject<T extends Entity>(name: string, obj: T) {
    const schema = toJsonSchema(obj) as JSONSchema
    return this.newCollection<T>(name, schema)
  }

  /**
   * newCollection creates a new empty collection from an input JSON schema.
   * @param name A name for the collection.
   * @param schema A valid JSON schema object.
   */
  async newCollection<T extends Entity>(name: string, schema: JSONSchema) {
    if (!this.threadID?.defined()) {
      await this.open()
    }
    if (this.collections.has(name)) {
      throw duplicateCollection
    }
    const key = schemaKey.instance(name)
    const exists = await this.child.has(key)
    if (!exists) {
      await this.child.put(key, cbor.encode(schema))
    }
    const { dispatcher, child } = this
    const collection = new Collection<T>(name, schema, { child, dispatcher })
    collection.child.on('update', this.onUpdate.bind(this))
    collection.child.on('events', this.onEvents.bind(this))
    this.collections.set(name, collection)
    return collection
  }

  /**
   * Open the database.
   * Opens the underlying datastore if not already open, and enables the dispatcher and
   * underlying services (event bus, network service, etc). If threadID is undefined, and the
   * database was already boostraped on a thread, it will continue using that thread. In the
   * opposite case, it will create a new thread. If threadID is provided, and the database was
   * not bootstraped on an existing thread, it will attempt to use the provided threadID,
   * otherwise, a thread id mismatch error is thrown.
   */
  async open(threadID?: ThreadID) {
    await this.child.open()
    const idKey = metaKey.child(new Key('threadid'))
    const hasExisting = await this.child.has(idKey)

    if (threadID === undefined) {
      if (hasExisting) {
        const existing = ThreadID.fromBytes(await this.child.get(idKey))
        this.threadID = existing
      } else {
        const info = await createThread(this.service)
        await this.child.put(idKey, info.id.bytes())
        this.threadID = info.id
      }
    } else {
      if (hasExisting) {
        const existing = ThreadID.fromBytes(await this.child.get(idKey))
        if (!existing.equals(threadID)) {
          throw new Error('Thread id mismatch')
        }
        this.threadID = existing
      } else {
        let info: ThreadInfo
        try {
          info = await this.service.getThread(threadID)
        } catch (_err) {
          info = await createThread(this.service, threadID)
        }
        await this.child.put(idKey, info.id.bytes())
        this.threadID = info.id
      }
    }
    await this.rehydrate()
    await this.eventBus.start(this.threadID)
    this.eventBus.on('record', this.onRecord.bind(this))
  }

  async getInfo() {
    if (this.threadID !== undefined) {
      const info = await this.service.getThread(this.threadID)
      const host = await this.service.getHostID()
      return {
        replicatorKey: info.replicatorKey,
        readKey: info.readKey,
        dbAddr: host.toB58String(), // @todo: Not currently correct
      }
    }
  }

  /**
   * Close and stop the database.
   * Stops the underlying datastore if not already stopped, and disables the dispatcher and
   * underlying services (event bus, network service, etc.)
   */
  async close() {
    this.collections.clear()
    await this.eventBus.stop()
    await this.child.close()
    // @todo: Should we also 'close' the dispatcher?
    return
  }

  private async onRecord(rec: ThreadRecord) {
    if (this.threadID?.equals(rec.threadID)) {
      const logInfo = await this.service.getOwnLog(this.threadID, false)
      if (logInfo?.id.isEqual(rec.logID)) {
        return // Ignore our own events since DB already dispatches to DB reducers
      }
      const info = await this.service.getThread(this.threadID)
      const value: Event<any> | undefined = decodeRecord(rec, info)
      if (value !== undefined) {
        const collection = this.collections.get(value.collection)
        if (collection !== undefined) {
          const key = collection.child.prefix.child(new Key(value.id))
          await this.dispatcher.dispatch({ key, value })
        }
      }
    }
  }

  private async onEvents(...events: Event<any>[]) {
    const id = this.threadID?.bytes()
    if (id !== undefined) {
      for (const body of events) {
        this.eventBus.push({ id, body })
      }
    }
  }

  private async onUpdate<T extends Entity>(...updates: Update<Op<T>>[]) {
    for (const update of updates) {
      // Event name: <collection>.<id>.<type>
      const event: string[] = [update.collection, update.id]
      if (update.type !== undefined) {
        event.push(update.type.toString())
      }
      this.emitter.emit(event, update)
    }
  }

  private async rehydrate() {
    const it = this.child.query({ prefix: schemaKey.toString() })
    for await (const { key, value } of it) {
      await this.newCollection(key.name(), cbor.decode(value) as JSONSchema)
    }
  }
}
