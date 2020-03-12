import { Result } from 'interface-datastore'
import toJsonSchema, { JSONSchema3or4 as JSONSchema } from 'to-json-schema'
import { randomBytes, PrivateKey, PublicKey, keys } from 'libp2p-crypto'
import cbor from 'cbor-sync'
import { Service, Client } from '@textile/threads-service'
import { Dispatcher, Entity, DomainDatastore, Event, Update } from '@textile/threads-store'
import { Datastore, MemoryDatastore, Key } from 'interface-datastore'
import { ThreadID, Variant, ThreadRecord } from '@textile/threads-core'
import { EventBus } from './eventbus'
import { Collection } from './collection'

const ed25519 = keys.supportedKeys.ed25519
const metaKey = new Key('meta')
const schemaKey = metaKey.child(new Key('schema'))
const duplicateCollection = new Error('Duplicate collection')

export type Options = {
  dispatcher?: Dispatcher
  eventBus?: EventBus
  service?: Service
}

export interface Database {
  /**
   * startFromAddress initializes the client with the given store, connecting to the given
   * thread address (database). It should be called before any operation on the store, and is an
   * alternative to start, which creates a local store. startFromAddress should also include the
   * read and service keys, which should be Buffer, Uint8Array or base58-encoded strings.
   * See `getStoreLink` for a possible source of the address and keys. It pulls the current
   * database thread from the remote peer/address.
   * @param address The address for the thread with which to connect.
   * Should be of the form /ip4/<url/ip-address>/tcp/<port>/p2p/<peer-id>/thread/<thread-id>
   * @param followKey Symmetric key. Uint8Array or base58-encoded string of length 44 bytes.
   * @param readKey Symmetric key. Uint8Array or base58-encoded string of length 44 bytes.
   */
  fromAddress(address: string, serviceKey: Uint8Array, readKey: Uint8Array): Promise<void>
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
  public child: Datastore<any>

  /**
   * Database creates a new database using the provided thread.
   * @param datastore the primary datastore, and is used to partition out stores as sub-domains.
   * @param options a set of database options.
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
    collection.child.on('events', this.onEvents.bind(this))
    collection.child.on('update', this.onUpdate.bind(this))
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
    if (await this.child.has(idKey)) {
      const existing = ThreadID.fromBytes(await this.child.get(idKey))
      if (threadID !== undefined && !existing.equals(threadID)) {
        throw new Error('Thread id mismatch')
      }
      this.threadID = existing
    } else {
      const replicatorKey = randomBytes(44)
      const readKey = randomBytes(44)
      // @todo: Let users/developers provide their own keys here.
      const logKey = await ed25519.generateKeyPair()
      const info = await this.service.createThread(
        threadID ?? ThreadID.fromRandom(Variant.Raw, 32),
        {
          readKey,
          replicatorKey,
          logKey,
        },
      )
      await this.child.put(idKey, info.id.bytes())
      this.threadID = info.id
    }
    await this.rehydrate()
    await this.eventBus.start(this.threadID)
    this.eventBus.on('record', this.onRecord.bind(this))
  }

  private onRecord(rec: ThreadRecord) {
    if (this.threadID?.equals(rec.threadID)) {
      console.log('onRecord', rec)
    }
  }

  private onEvents(...events: Event<any>[]) {
    const id = this.threadID?.bytes()
    console.log('onEvents', events)
    if (id !== undefined) {
      for (const body of events) {
        this.eventBus.push({ id, body })
      }
    }
  }

  private onUpdate(...updates: Update<any>[]) {
    console.log('onUpdate', updates)
  }

  private async rehydrate() {
    const it = this.child.query({ prefix: schemaKey.toString() })
    for await (const { key, value } of it) {
      await this.newCollection(key.name(), cbor.decode(value) as JSONSchema)
    }
  }

  /**
   * Close and stop the database.
   * Stops the underlying datastore if not already stopped, and disables the dispatcher and
   * underlying services (event bus, network service, etc.)
   */
  async close() {
    await this.eventBus.stop()
    await this.child.close()
    return
  }
}
