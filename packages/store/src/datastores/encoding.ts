import { Datastore, Key, Batch, Query } from 'interface-datastore'
import { map } from 'streaming-iterables'

export interface Encoder<T = Buffer, O = Buffer> {
  encode(data: T): O
  decode(stored: O): T
}

/**
 * A datastore shim, that wraps around a given datastore, adding support for custom encoding/decoding of values.
 */
export class EncodingDatastore<T = Buffer, O = Buffer> implements Datastore<T> {
  /**
   * ValueTransformDatastore creates a new datastore that supports custom encoding/decoding of values.
   *
   * @param child The underlying datastore to wrap.
   * @param transform A transform object to use for encoding/decoding.
   */
  constructor(public child: Datastore<O>, public encoder: Encoder<T, O>) {}

  open() {
    return this.child.open()
  }

  put(key: Key, val: T) {
    return this.child.put(key, this.encoder.encode(val))
  }

  async get(key: Key) {
    return this.encoder.decode(await this.child.get(key))
  }

  has(key: Key) {
    return this.child.has(key)
  }

  delete(key: Key) {
    return this.child.delete(key)
  }

  batch() {
    const b: Batch<O> = this.child.batch()
    const batch: Batch<T> = {
      put: (key: Key, value: T) => {
        b.put(key, this.encoder.encode(value))
      },
      delete: (key: Key) => {
        b.delete(key)
      },
      commit: () => {
        return b.commit()
      },
    }
    return batch
  }

  /**
   * Search the store.
   * Returns an Iterable with each item being a Value (i.e., { key, value } pair).
   * @param query The query object.
   */
  query(q: Query<T>) {
    const results = this.child.query((q as any) as Query<O>)
    return map(({ key, value }) => {
      return { key, value: this.encoder.decode(value) }
    }, results)
  }

  close() {
    return this.child.close()
  }
}
