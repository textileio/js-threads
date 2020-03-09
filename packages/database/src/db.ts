import { Service } from '@textile/threads-service'
import { Dispatcher, Entity } from '@textile/threads-store'
import { Datastore } from 'interface-datastore'
import { EventBus } from './eventbus'

export interface Store {
  /**
   * registerSchema registers a new model schema under the given name on the remote node.
   * The schema must be a valid json-schema.org schema, and can be a JSON string or Javascript object.
   * @param name The human-readable name for the model.
   * @param schema The actual json-schema.org compatible schema object.
   */
  registerSchema(storeID: string, name: string, schema: any): Promise<void>

  /**
   * startFromAddress initializes the client with the given store, connecting to the given
   * thread address (database). It should be called before any operation on the store, and is an
   * alternative to start, which creates a local store. startFromAddress should also include the
   * read and follow keys, which should be Buffer, Uint8Array or base58-encoded strings.
   * See `getStoreLink` for a possible source of the address and keys.
   * @param address The address for the thread with which to connect.
   * Should be of the form /ip4/<url/ip-address>/tcp/<port>/p2p/<peer-id>/thread/<thread-id>
   * @param followKey Symmetric key. Uint8Array or base58-encoded string of length 44 bytes.
   * @param readKey Symmetric key. Uint8Array or base58-encoded string of length 44 bytes.
   */
  fromAddress(address: string, followKey: Uint8Array, readKey: Uint8Array): Promise<void>

  /**
   * listen opens a long-lived connection with a remote node, running the given callback on each new update to the given entity.
   * The return value is a `close` function, which cleanly closes the connection with the remote node.
   * @param modelName The human-readable name of the model to use.
   * @param entityID The id of the entity to monitor.
   * @param callback The callback to call on each update to the given entity.
   */
  listen<T extends Entity>(modelName: string, entityID: string, callback: (reply?: T, err?: Error) => void): void
}

// Database is the whole thing
//   Store is a single Thread/topic/domain/idea
//     Collection is a single Model or Entity type (only relevant in some cases) essentially it is a sub-store

export interface Database {
  // stores are a set of Thread-scoped stores (database tables)
  stores: Map<string, Store>
  // service is the networking layer
  service: Service
  // datastore is the primary datastore, and is used to partition out stores as sub-domains
  datastore: Datastore
  // eventBus is used to marshal events to and from a Threads service
  eventBus: EventBus
  // dispatcher is used to dispatch local events from producers (stores) to reducers (also stores)
  dispatcher: Dispatcher

  // createStore...
  // 1. creates a new store and associated Thread
  // 2. Connects the store with the dispatcher
  // 3. Connects the store with the eventBus
  // 4. Persists information about the store to its internal storage

  /**
   * newStore creates a new store on the remote node.
   */
  newStore(): Promise<void>
}
