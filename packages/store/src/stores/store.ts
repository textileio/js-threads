import { Datastore, Key, Result, Batch, Query } from 'interface-datastore'
import lexInt from 'lexicographic-integer'
import { EventEmitter } from 'tsee'
import { mix } from 'ts-mixer'
import { Reducer, Dispatcher } from '../dispatcher'
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

/**
 * Event is a local or remote event.
 */
export interface Event<T = any> {
  timestamp: Buffer
  id: string
  collection: string
  patch?: T // actual event body
}

export interface ActionDispatcher {
  dispatch(...actions: Action<Event>[]): Promise<void>
}

export class ActionBatch<T = any, A = any> implements Batch<T> {
  private patches: Action<Event>[] = []
  constructor(
    private store: Store<T, A>,
    private onDelete: (key: Key) => Promise<A>,
    private onPut: (key: Key, value: T) => Promise<A>,
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

  put(key: Key, value: T) {
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

export interface Store<D = any, A = any>
  extends Lockable,
    EventEmitter<Events<A>>,
    Datastore<D>,
    Reducer<A>,
    ActionDispatcher {}
@mix(EventEmitter, Lockable)
export abstract class Store<D = any, A = any> implements Datastore<D>, Reducer<A>, ActionDispatcher {
  public child: Datastore<D>
  constructor(
    child: Datastore<Buffer>,
    public prefix: Key,
    readonly dispatcher?: Dispatcher,
    encoder: Encoder<D, Buffer> = CborEncoder,
  ) {
    this.child = new EncodingDatastore(new DomainDatastore(child, prefix), encoder)
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
        const key = new Key(value.id).child(new Key(value.collection)).child(new Key(value.timestamp.toString()))
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

  abstract batch(): ActionBatch<D>

  abstract async reduce(...events: Result<A>[]): Promise<void>
}
