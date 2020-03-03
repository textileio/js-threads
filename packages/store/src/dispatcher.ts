import log from 'loglevel'
import { ulid } from 'ulid'
import { decode } from 'cbor-sync'
import { Datastore, Key, Result } from 'interface-datastore'
import { map } from 'streaming-iterables'
import { encode } from 'cbor-sync'
import { RWLock } from 'async-rwlock'

const logger = log.getLogger('store:dispatcher')

/**
 * Reducer applies an event to an existing state.
 */
export interface Reducer<T = any> {
  reduce(...events: Result<T>[]): Promise<void>
}

/**
 * Dispatcher is used to dispatch events to registered reducers.
 * This is different from generic pub-sub systems because reducers are not subscribed to particular events.
 * Every event is dispatched to every registered reducer. Dispatcher is based on the singleton dispatcher utilized
 * in the "Flux" pattern (see https://github.com/facebook/flux).
 */
export class Dispatcher extends RWLock {
  public reducers: Set<Reducer<any>> = new Set()

  /**
   * Dispatcher creates a new dispatcher.
   * @param store The optional event 'log' to persist events. If undefined this is treated as a stateless dispatcher.
   */
  constructor(public store?: Datastore<Buffer>) {
    super()
  }

  /**
   * Register takes a reducer to be invoked with each dispatched event.
   * @param reducer A reducer for processing dispatched events.
   */
  async register<T>(reducer: Reducer<T>) {
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
    return map(mapper, this.store?.query({ prefix }) || [])
  }

  /**
   * Dispatch dispatches a payload to all registered reducers.
   * @param events The (variadic list of) events to dispatch.
   */
  async dispatch<T>(...events: Result<T>[]) {
    await this.writeLock()
    try {
      if (this.store) {
        logger.debug('persisting events')
        const batch = this.store.batch()
        for (const { key, value } of events) {
          batch.put(key.instance(ulid()), encode(value))
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
