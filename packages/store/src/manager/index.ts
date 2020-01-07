import { Datastore, MemoryDatastore, Key } from 'interface-datastore'
import log from 'loglevel'
import uuid from 'uuid'
import { Entity, Event, Service, EventCodec } from '@textile/threads-core'
import { NamespaceDatastore } from 'datastore-core'
import { Store, StoreID } from '../store'

const logger = log.getLogger('store:manager')

const baseKey = new Key('manager')

export class StoreManager<E extends Event, T extends Entity = object> {
  constructor(
    public service: Service,
    private datastore: Datastore = new MemoryDatastore(),
    public stores: Map<StoreID, Store<E, T>> = new Map(), // threadService: ThreadService
  ) {}
  // Load hydrates stores from prefixes and starts them.
  static async load<E extends Event>(
    service: Service,
    datastore?: Datastore,
    eventCodec?: EventCodec<E>,
    debug = true,
  ) {
    if (debug) {
      for (const [key, value] of Object.entries(log.getLoggers())) {
        if (key.startsWith('store')) {
          value.setDefaultLevel('DEBUG')
        }
      }
    }
    const manager = new StoreManager(service, datastore)
    for await (const { key } of manager.datastore.query({
      prefix: baseKey.toString(),
      keysOnly: true,
    })) {
      if (key.baseNamespace() !== 'threadid') continue
      const id = key
        .parent()
        .parent()
        .name()
      if (manager.stores.has(id)) continue
      const s = new Store(manager.service, manager.datastore, eventCodec)
      // @todo: From Go reference implementation: Auto-starting reloaded stores could lead to issues (#115)/
      s.start()
      manager.stores.set(id, s)
    }
    return manager
  }

  // NewStore creates a new store and prefix its datastore with base key.
  newStore(eventCodec?: EventCodec<E>) {
    const id = uuid()
    const datastore = new NamespaceDatastore(this.datastore, new Key(id))
    const store = new Store<E, T>(this.service, datastore, eventCodec)
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
