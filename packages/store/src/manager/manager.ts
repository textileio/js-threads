import { Datastore, MemoryDatastore } from 'interface-datastore'
import log from 'loglevel'
import uuid from 'uuid'
import { Store, StoreID } from '../store'
import { Interface } from '.'

const logger = log.getLogger('store:manager')

export class StoreManager implements Interface {
  constructor(
    private datastore: Datastore = new MemoryDatastore(),
    public stores: Map<StoreID, Store> = new Map(), // threadService: ThreadService
  ) {}
  // Load hydrates stores from prefixes and starts them.
  static async load(datastore?: Datastore, debug = true) {
    if (debug) {
      for (const [key, value] of Object.entries(log.getLoggers())) {
        if (key.startsWith('store')) {
          value.setDefaultLevel('DEBUG')
        }
      }
    }
    const manager = new StoreManager(datastore)
    for await (const { key } of manager.datastore.query({ prefix: 'manager', keysOnly: true })) {
      if (key.baseNamespace() !== 'threadid') continue
      const id = key
        .parent()
        .parent()
        .name()
      if (manager.stores.has(id)) continue
      // @todo: Add the required imports (i.e., ThreadService, Options)
      const s = new Store()
      // @todo: From Go reference implementation: Auto-starting reloaded stores could lead to issues (#115)/
      s.start()
      manager.stores.set(id, s)
    }
    return manager
  }

  // NewStore creates a new store and prefix its datastore with base key.
  newStore() {
    const id = uuid()
    // @todo: Add the required imports (i.e., ThreadService, Options)
    const store = new Store()
    this.stores.set(id, store)
    return { id, store }
  }

  // Get returns a store by id from the in-mem map.
  get(id: StoreID) {
    return this.stores.get(id)
  }
  // Close all the in-mem stores.
  async close() {
    for (const [key, value] of this.stores.entries()) {
      try {
        await value.close()
      } catch (err) {
        logger.error(`error when closing manager datastore ${key}`)
      }
    }
    // return this.datastore.close()
  }
}
