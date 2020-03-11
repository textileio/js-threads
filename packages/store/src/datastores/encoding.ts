import { Datastore, Key, Batch, Query, utils } from 'interface-datastore'
import cbor from 'cbor-sync'

export interface Encoder<T = Buffer, O = Buffer> {
  encode(data: T): O
  decode(stored: O): T
}

// 258 is the CBOR semantic tag number for a mathematical finite set:
// https://www.iana.org/assignments/cbor-tags/cbor-tags.xhtml
cbor.addSemanticEncode(258, function(data) {
  if (data instanceof Set) {
    return Array.from(data)
  }
})
cbor.addSemanticDecode(258, function(data) {
  return new Set(data)
})

// 259 is the CBOR semantic tag number for a Map datatype with key-value operations
cbor.addSemanticEncode(259, function(data) {
  if (data instanceof Map) {
    return Array.from(data)
  }
})
cbor.addSemanticDecode(259, function(data) {
  return new Map(data)
})

export const CborEncoder: Encoder<any, Buffer> = {
  encode: (data: any) => cbor.encode(data),
  decode: (stored: Buffer) => cbor.decode(stored),
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
    // @todo: Wrap all filters and orders in a decode call?
    const { keysOnly, prefix, ...rest } = q
    const raw = this.child.query({ keysOnly, prefix })
    let it = utils.map(raw, ({ key, value }) => {
      return { key, value: this.encoder.decode(value) }
    })
    if (Array.isArray(rest.filters)) {
      it = rest.filters.reduce((it, f) => utils.filter(it, f), it)
    }
    if (Array.isArray(rest.orders)) {
      it = rest.orders.reduce((it, f) => utils.sortAll(it, f), it)
    }
    if (rest.offset) {
      let i = 0
      it = utils.filter(it, () => i++ >= (rest.offset || 0))
    }
    if (rest.limit) {
      it = utils.take(it, rest.limit)
    }
    return it
  }

  close() {
    return this.child.close()
  }
}
