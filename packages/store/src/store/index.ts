import { Datastore, Key, MemoryDatastore } from 'interface-datastore'
import Schema, { Ajv } from 'ajv'
import { JSONSchema3or4 as JSONSchema } from 'to-json-schema'
import { EventEmitter } from 'tsee'
import { RWLock } from 'async-rwlock'
import { encode, decode } from 'cbor-sync'
import { ID } from '@textile/threads-core'
import { Dispatcher, Reducer } from '../dispatcher'
import { Collection, CollectionKey } from '../collection'
import { EventCodec, JSONPatcher, ReduceAction } from '../codecs'
import { Block, Action, Event, Entity } from '..'

const storeKey = new Key('store')
const threadKey = storeKey.child(new Key('threadid'))
const schemaKey = storeKey.child(new Key('schema'))

// Events are for the store's EventEmitter
type Events = {
  events: (events: Event[]) => void
  localEvent: (event: Block) => void
  stateChange: (actions: Action[]) => void
}

export type StoreID = string

// Store is the aggregate-root of events and state. External/remote events
// are dispatched to the Store, and are internally processed to impact model
// states. Likewise, local changes in models registered produce events dispatched
// externally.
export class Store<E extends Event = any, T extends Entity = object> extends EventEmitter<Events> implements Reducer {
  // public adapter: ThreadAdapter
  /**
   * The ThreadService used by the store
   */
  // public threadService: ThreadService
  // private lock: RWLock = new RWLock()
  private dispatcher: Dispatcher
  private schema: Ajv = new Schema()
  public eventCodec: EventCodec<E>
  public collections: Map<StoreID, Collection<T>> = new Map()
  private datastore: Datastore<Buffer>
  /**
   * Store creates a new Store.
   * The Store will *own* the input datastore and dispatcher, so these should not be accessed externally.
   * @param datastore The datastore to use for internal storage.
   * @param eventCodec The EventCodec to use for processing actions -> events.
   */
  constructor(datastore: Datastore<Buffer> = new MemoryDatastore(), eventCodec: EventCodec<any> = JSONPatcher.Codec) {
    super()
    this.datastore = datastore
    this.eventCodec = eventCodec
    this.dispatcher = new Dispatcher()
    this.dispatcher.register(this)
    this.registerSchemas()
  }
  /**
   * ThreadID returns the store's theadID if it exists.
   */
  async threadID() {
    try {
      return ID.fromBytes(await this.datastore.get(threadKey))
    } catch (err) {
      return undefined
    }
  }
  /**
   * Start the Store.
   * Start should be called immediately after registering all schemas and before any operation on them.
   * If the store already bootstraped on a thread, it will continue using that thread.
   * In the opposite case, it will create a new thread.
   */
  async start(): Promise<void> {
    const id = (await this.threadID()) || ID.fromRandom()
    // @todo: Implement this
    // utils.createThread(id)
    this.datastore.put(threadKey, id.bytes())
    // this.adapter = new ThreadAdapter()
    // this.adapter.start()
    return
  }
  /**
   * StartFromAddr should be called immediately after registering all schemas and before any operation on them.
   * It pulls the current Store thread from thread addr
   * @param addr Full thread multiaddr.
   * @param replicateKey The replicator key.
   * @param readKey The read key.
   */
  async startFromAddress(addr: string, replicateKey: Buffer, readKey: Buffer) {
    return
  }
  async close() {
    // this.adapter.close()
    this.removeAllListeners()
    this.datastore.close()
    return
  }

  /**
   * reregisterSchemas loads and registers schemas from the datastore.
   */
  async registerSchemas() {
    const it = this.datastore.query({ prefix: schemaKey.toString() })
    for await (const { key, value } of it) {
      const name = key.name()
      this.registerSchema(name, decode(value))
    }
    return
  }

  // ActionHandler
  async handler(actions: Array<Action<T>>): Promise<void> {
    const { events, block } = await this.eventCodec.encode(actions)
    await this.dispatcher.dispatch(...events) // Calls reduce below...
    this.emit('localEvent', block)
    return
  }

  /**
   * Reducer function.
   * @param events The set of events to reduce.
   */
  async reduce(...events: E[]) {
    const batch = this.datastore.batch()
    const actions: ReduceAction[] = []
    for (const event of events) {
      let oldState: T | undefined
      const key = CollectionKey.child(new Key(event.collection)).child(new Key(event.entityID))
      try {
        oldState = decode(await this.datastore.get(key))
      } catch (err) {
        if (err.toString() !== 'Error: Not Found') {
          throw err
        }
      }
      const { state, action } = await this.eventCodec.reduce(oldState, event)
      actions.push(action)
      switch (action.type) {
        case Action.Type.Delete:
          batch.delete(key)
          break
        case Action.Type.Create:
          if (oldState) throw new Error('Existing Entity')
        case Action.Type.Save:
          batch.put(key, encode(state))
          break
        default:
          throw new Error('Unknown Operation')
      }
    }
    batch.commit()
    this.emit('stateChange', actions)
  }

  /**
   * Register a new collection in the store with a JSON schema.
   * @param name The human-readable name for the collection.
   * @param schema The JSON Schema,
   */
  async registerSchema(name: string, schema: JSONSchema) {
    if (this.collections.has(name)) {
      throw new Error('Already Registered')
    }
    const compiled = this.schema.addSchema(schema, name).compile(schema)
    const collection = new Collection(name, compiled, this.handler.bind(this), this.datastore)
    const key = storeKey.child(new Key(name))
    const exists = this.datastore.has(key)
    if (!exists) {
      this.datastore.put(key, encode(schema))
    }
    this.collections.set(name, collection)
  }

  /**
   * Get a collection from the store.
   * @param name The name of the collection.
   */
  async getCollection(name: string) {
    return this.collections.get(name)
  }
}
