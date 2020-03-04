import { Datastore, Result, Key } from 'interface-datastore'
import CRDT from 'delta-crdts'
import { Dispatcher } from '../dispatcher'
import { Encoder, CborEncoder } from '../datastores/encoding'
import { Store, ActionBatch } from './store'

const Class = CRDT('mvreg')

export interface MVReg<T = any, D = T> {
  id: string
  value(): T
  apply(delta: D): D
  write(data: T): D
  state(): D
  join(other: D): D
}

/**
 * Encoder for persisting MVReg CRDTs using their default msgpack codec.
 */
export const MVRegEncoder: Encoder<MVReg, Buffer> = {
  encode: data => CborEncoder.encode(data.state()),
  decode: stored => {
    const replica = Class()
    replica.apply(CborEncoder.decode(stored))
    return replica
  },
}

export class MVRegStore extends Store<any, any> {
  constructor(child: Datastore<Buffer>, public prefix: Key, readonly dispatcher: Dispatcher) {
    super(child, prefix, dispatcher, MVRegEncoder)
  }

  async reduce(...events: Result<any>[]): Promise<void> {
    const batch = this.child.batch()
    for (const { key, value } of events) {
      if (!key.isDecendantOf(this.prefix)) continue // Only want to apply updates from this store
      const prev = await this.safeGet(key)
      if (prev === undefined) {
        batch.put(key, value)
      } else {
        const merged = prev.apply(value)
        if (merged.value() === undefined) {
          batch.delete(key)
        } else {
          batch.put(key, merged)
        }
      }
    }
    return await batch.commit()
  }

  batch(): ActionBatch<any> {
    return new ActionBatch(
      this,
      async key => Class(this.prefix.child(key).toString()).write(undefined),
      async (key, value) => Class(this.prefix.child(key).toString()).write(value),
    )
  }
}
