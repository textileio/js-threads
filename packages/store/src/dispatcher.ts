import log from 'loglevel'
import { ulid } from 'ulid'
import { decode } from 'cbor-sync'
import { Datastore, Key, Result, MemoryDatastore } from 'interface-datastore'
import { map } from 'streaming-iterables'
import { RWLock } from 'async-rwlock'
import { CborEncoder } from './datastores/encoding'
import { DomainDatastore } from './datastores'

const logger = log.getLogger('store:dispatcher')

/**
 * Reducer applies an event to an existing state.
 */
export interface Reducer<T extends Event> {
  reduce(...events: Result<T>[]): Promise<void>
}

export type EventDispatcher<A> = (...actions: Result<Event<A>>[]) => Promise<void>

/**
 * Event is a local or remote event.
 */
export interface Event<T = any> {
  timestamp: Buffer
  id: string
  collection: string
  patch?: T // actual event body
}

/**
 * Dispatcher is used to dispatch events to registered reducers.
 * This is different from generic pub-sub systems because reducers are not subscribed to particular events.
 * Every event is dispatched to every registered reducer. Dispatcher is based on the singleton dispatcher utilized
 * in the "Flux" pattern (see https://github.com/facebook/flux).
 */
export class Dispatcher extends RWLock {
  public reducers: Set<Reducer<any>> = new Set()
  public child: Datastore<Buffer>

  /**
   * Dispatcher creates a new dispatcher.
   * @param store The optional event 'log' to persist events. If undefined this is treated as a stateless dispatcher.
   */
  constructor(child?: Datastore<Buffer>) {
    super()
    this.child = new DomainDatastore(child || new MemoryDatastore(), new Key('dispatcher'))
  }

  /**
   * Register takes a reducer to be invoked with each dispatched event.
   * @param reducer A reducer for processing dispatched events.
   */
  async register<T extends Event>(reducer: Reducer<T>) {
    await this.writeLock()
    this.reducers.add(reducer)
    this.unlock()
    logger.debug(`registered reducers: ${this.reducers.size}`)
  }

  replay(prefix?: string) {
    const mapper = ({ key, value }: Result<Buffer>) => {
      const result: Result<any> = { key: new Key(key.type()), value: decode(value) }
      return result
    }
    return map(mapper, this.child?.query({ prefix }) || [])
  }

  /**
   * Dispatch dispatches a payload to all registered reducers.
   * @param events The (variadic list of) events to dispatch.
   */
  async dispatch<T extends Event>(...events: Result<T>[]) {
    await this.writeLock()
    try {
      if (this.child) {
        logger.debug('persisting events')
        const batch = this.child.batch()
        for (const { key, value } of events) {
          batch.put(key.instance(ulid()), CborEncoder.encode(value))
        }
        await batch.commit()
      }
      logger.debug('dispatching')
      await Promise.all([...this.reducers].map((reducer: Reducer<T>) => reducer.reduce(...events)))
    } finally {
      this.unlock()
    }
  }
}
