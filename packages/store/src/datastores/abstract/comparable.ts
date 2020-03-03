import { Datastore, Key } from 'interface-datastore'

/**
 * Comparer provides facilities for comparing and combining objects.
 */
export interface Comparer<Value = Buffer, Delta = Buffer> {
  /**
   * Compare and compute the difference between two objects.
   * @param value The original object.
   * @param update The new/updated object.
   */
  compare(value: Value | undefined, update: Value): Delta

  /**
   * Apply a delta to an existing object.
   * @param value The original object.
   * @param delta The delta/change object.
   */
  combine(value: Value | undefined, delta: Delta): Value
}

/**
 * A datastore shim.
 */
export class Comparable<T = Buffer, D = Buffer> {
  /**
   * ValueTransformDatastore creates a new datastore that supports custom encoding/decoding of values.
   *
   * @param child The underlying datastore to wrap.
   * @param transform A transform object to use for encoding/decoding.
   */
  constructor(public child: Datastore<T>, public comparer: Comparer<T, D>) {}

  /**
   * Compare and compute the difference between two objects.
   * @param key The key at which to find the original object.
   * @param update The new/updated object.
   */
  async compare(key: Key, update: T) {
    return this.comparer.compare(await this.safeGet(key), update)
  }

  /**
   * Apply a delta to an existing object.
   * @param key The key at which to find the original object.
   * @param delta The delta/change object.
   */
  async combine(key: Key, delta: D) {
    return this.comparer.combine(await this.safeGet(key), delta)
  }

  async safeGet(key: Key) {
    try {
      return this.child.get(key)
    } catch (err) {
      if (!err.toString().includes('Not found')) {
        throw new Error(err)
      }
    }
  }
}
