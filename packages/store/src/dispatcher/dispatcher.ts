import { RWLock } from 'async-rwlock'
import log from 'loglevel'
import { Reducer, Interface } from '.'
import { Event } from '..'

const logger = log.getLogger('store:dispatcher')

/**
 * Dispatcher is used to dispatch events to registered reducers.
 * This is different from generic pub-sub systems because reducers are not subscribed to particular events.
 * Every event is dispatched to every registered reducer. Dispatcher is based on the singleton dispatcher utilized
 * in the "Flux" pattern (see https://github.com/facebook/flux).
 */
export class Dispatcher implements Interface {
  private lock: RWLock = new RWLock()
  public reducers: Set<Reducer> = new Set()

  /**
   * Register takes a reducer to be invoked with each dispatched event.
   * @param reducer A reducer for processing dispatched events.
   */
  async register(reducer: Reducer) {
    await this.lock.writeLock()
    this.reducers.add(reducer)
    this.lock.unlock()
    logger.debug(`registered reducers: ${this.reducers.size}`)
  }

  /**
   * Dispatch dispatches a payload to all registered reducers.
   * @param events The (variadic list of) events to dispatch.
   */
  async dispatch(...events: Event[]) {
    await this.lock.writeLock()
    try {
      logger.debug(`dispatching reducers: ${this.reducers.size}`)
      await Promise.all([...this.reducers].map(reducer => reducer.reduce(...events)))
    } catch (err) {
      logger.error(err)
      throw err
    } finally {
      this.lock.unlock()
    }
  }
}
