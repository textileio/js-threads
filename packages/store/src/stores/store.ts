import { Datastore, Key, Result, Batch, Query } from 'interface-datastore'
import lexInt from 'lexicographic-integer'
import { EventEmitter } from 'tsee'
import { Semaphore } from '../datastores/abstract/lockable'
import { Reducer, Dispatcher, Event } from '../dispatcher'
import { EncodingDatastore, Encoder, CborEncoder } from '../datastores/encoding'
import { DomainDatastore } from '../datastores/domain'
import { Lockable } from '../datastores/abstract/lockable'

/**
 * Events for Store's EventEmitter
 */
type Events<T> = {
  open: () => void
  close: () => void
  events: (...events: Event<T>[]) => void
  update: (...updates: Update[]) => void // Generic not yet used...
  error: (err: Error) => void
}

export type Action<T> = () => Promise<T>

export interface Update<T = any> {
  id: string
  collection: string
  meta?: T
}

export class ActionBatch<D = any, A = D> implements Batch<D> {
  private patches: Action<Event<A>>[] = []
  constructor(
    private store: Store<D, A>,
    private onDelete: (key: Key) => Promise<A | undefined>,
    private onPut: (key: Key, value: D) => Promise<A>,
  ) {}

  delete(key: Key) {
    const deferred = async () => {
      const event: Event = {
        timestamp: Buffer.from(lexInt.pack(Date.now())),
        id: key.toString(),
        collection: this.store.prefix.toString(),
        patch: await this.onDelete(key),
      }
      return event
    }
    this.patches.push(deferred)
  }

  put(key: Key, value: D) {
    const deferred = async () => {
      const event: Event = {
        timestamp: Buffer.from(lexInt.pack(Date.now())),
        id: key.toString(),
        collection: this.store.prefix.toString(),
        patch: await this.onPut(key, value),
      }
      return event
    }
    this.patches.push(deferred)
  }

  async commit() {
    if (this.patches.length > 0) {
      await this.store.dispatch(...this.patches)
    }
    return
  }
}

// export interface Store<D = any, A = D>
//   extends Lockable,
//     EventEmitter<Events<A>>,
//     Datastore<D>,
//     Reducer<Event<A>>,
//     ActionDispatcher<A> {}
// @mix(, Lockable)
export abstract class Store<D = any, A = D> extends EventEmitter<Events<A>>
  implements Lockable, Datastore<D>, Reducer<Event<A>> {
  public child: Datastore<D>
  readonly semaphore: Semaphore
  constructor(
    child: Datastore<Buffer>,
    public prefix: Key,
    public dispatcher?: Dispatcher,
    public encoder: Encoder<D, Buffer> = CborEncoder,
  ) {
    super()
    this.child = new EncodingDatastore(new DomainDatastore(child, this.prefix), this.encoder)
    this.semaphore = new Semaphore(this.prefix)
    if (this.dispatcher) {
      this.dispatcher.register(this)
    }
  }

  /**
   * Acquire a read lock on a given key.
   * The datastore is only allowed to acquire a lock for keys it 'owns' (any decedents of its prefix key).
   * @param key The key to lock for reading.
   * @param timeout How long to wait to acquire the lock before rejecting the promise, in milliseconds.
   * If timeout is not in range 0 <= timeout < Infinity, it will wait indefinitely.
   */
  readLock(key: Key, timeout?: number) {
    return this.semaphore.get(key).readLock(timeout)
  }

  /**
   * Acquire a write lock on a given key.
   * The datastore is only allowed to acquire a lock for keys it 'owns' (any decedents of its prefix key).
   * @param key The key to lock for writing.
   * @param timeout How long to wait to acquire the lock before rejecting the promise, in milliseconds.
   * If timeout is not in range 0 <= timeout < Infinity, it will wait indefinitely.
   */
  writeLock(key: Key, timeout?: number) {
    return this.semaphore.get(key).writeLock(timeout)
  }

  /**
   * Release current lock.
   * Must be called after an operation using a read/write lock is finished.
   * @param key The key to unlock.
   */
  unlock(key: Key) {
    return this.semaphore.unlock(key)
  }

  async safeGet(key: Key) {
    try {
      return await this.child.get(key)
    } catch (err) {
      if (err.code !== 'ERR_NOT_FOUND') {
        throw err
      }
    }
  }

  async dispatch(...actions: Action<Event<A>>[]) {
    if (this.dispatcher === undefined) return
    const events = await Promise.all(
      actions.map(async event => {
        const value = await event()
        const key = this.prefix.child(new Key(value.id))
        return { key, value }
      }),
    )
    this.emit('events', ...events.map(event => event.value))
    return this.dispatcher.dispatch(...events)
  }

  open() {
    return this.child.open()
  }

  close() {
    return this.child.close()
  }

  has(key: Key) {
    return this.child.has(key)
  }

  get(key: Key) {
    return this.child.get(key)
  }

  put(key: Key, value: D) {
    const batch = this.batch()
    batch.put(key, value)
    return batch.commit()
  }

  delete(key: Key) {
    const batch = this.batch()
    batch.delete(key)
    return batch.commit()
  }

  query(query: Query<D>) {
    return this.child.query(query)
  }

  abstract batch(): ActionBatch<D, A>

  abstract async reduce(...events: Result<Event<A>>[]): Promise<void>
}
