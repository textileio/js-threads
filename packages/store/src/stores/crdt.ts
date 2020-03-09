import { Datastore, Result, Key } from 'interface-datastore'
import { Dispatcher, Event } from '../dispatcher'
import { Encoder, CborEncoder } from '../datastores/encoding'
import { Store, ActionBatch } from './store'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CRDT = require('delta-crdts')

// We should try to support any CRDT that supports Causal Context
// https://arxiv.org/pdf/1603.01529.pdf
export interface CRDT {
  id: string
  value(): any
  apply(delta: CRDT): CRDT
  state(): any
  join(other: CRDT): CRDT
  [other: string]: any
}

export interface State {
  id: string
  state: any
}

/**
 * Encoder for persisting Delta CRDTs.
 */
export const CRDTEncoder = (type: string) => {
  const encoder: Encoder<CRDT, Buffer> = {
    encode: data => {
      return CborEncoder.encode({ id: data.id, state: data.state() })
    },
    decode: stored => {
      const decoded = CborEncoder.decode(stored)
      const replica: CRDT = CRDT(type)(decoded.id)
      replica.apply(decoded.state)
      return replica
    },
  }
  return encoder
}

export class CRDTStore extends Store<CRDT, State> {
  constructor(child: Datastore<any>, prefix: Key, dispatcher?: Dispatcher, readonly type = 'mvreg') {
    super(child, prefix, dispatcher, CRDTEncoder(type))
  }

  async reduce(...events: Result<Event<State>>[]): Promise<void> {
    const batch = this.child.batch()
    for (const { key, value } of events) {
      if (!key.isDecendantOf(this.prefix)) continue // Only want to apply updates from this store
      const newKey = new Key(value.id)
      const prev = await this.safeGet(newKey)
      if (prev === undefined) {
        if (value.patch) {
          const temp: CRDT = CRDT(this.type)(value.patch.id)
          temp.apply(value.patch.state)
          batch.put(newKey, temp)
        }
      } else {
        if (value.patch === undefined) {
          batch.delete(newKey)
        } else {
          prev.apply(value.patch.state)
          if (prev.value() === undefined) {
            batch.delete(newKey)
          } else {
            batch.put(newKey, prev)
          }
        }
      }
    }
    await batch.commit()
    this.emit('update', ...events.map(event => event.value))
  }

  batch(): ActionBatch<CRDT, State> {
    return new ActionBatch(
      this,
      async _key => undefined,
      async (_key, value) => {
        const { id, state } = value
        return { id, state: state() }
      },
    )
  }
}
