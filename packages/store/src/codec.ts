import { Result, Key } from 'interface-datastore'
import { ulid } from 'ulid'
import * as cbor from 'cbor-sync'
import crdt from 'delta-crdts'

/**
 * Codec is a generic interface for encoding, decoding, and merging (reducing) custom objects.
 * It can facilitate managing state, and can produce outputs required for remote sharing of events.
 */
export interface Codec<Model = any, Value = Buffer, Change = Model> {
  encode(data: Model): Result<Value>
  decode(data: Value): Model
  reduce(state: Model | undefined, change: Change): Model
  // compare(oldState: Model, newState: Model): Change
}

/**
 * Entity is any object with an ID field.
 */
export interface Entity {
  ID: string
}

/**
 * JsonPatch is a Codec that creates and applies JSON Patch objects, with encoding to/from CBOR IPLD DAGs.
 */

/**
 * PassThrough is a Codec that overwrites existing state, with encoding via plain CBOR.
 */
export const PassThrough: Codec = {
  encode(data: any) {
    return { key: new Key(ulid()), value: cbor.encode(data) }
  },
  decode(data: Buffer) {
    return cbor.decode(data)
  },
  reduce(_state: any, ...changes: any[]) {
    return changes
  },
}

type Delta = any

export interface CRDT<T = any, D = any> {
  id: string
  value(): T
  apply(delta: T | D): T
  state(): CRDT<T, D>
}

export interface CRDTConstructor<T = any, D = any> {
  (id: string): CRDT<T, D>
  initial(): T
  join(s1: T, s2: T): T
  value(state: T): T
  mutators: Record<string, Function>
}

const MVRegType: CRDTConstructor = crdt('mvreg')

/**
 * MVReg is a Codec that provides a multi-value register for handling concurrently modified states.
 */
export const MVReg: Codec<CRDT, Buffer, Delta> = {
  encode(state: CRDT) {
    return { key: new Key(state.id), value: cbor.encode({ id: state.id, ...state.state() }) }
  },
  decode(data: Buffer) {
    const { id, ...state } = cbor.decode(data)
    return MVRegType(id).apply(state)
  },
  reduce(state: CRDT, change: Delta | CRDT) {
    return state.apply(change)
  },
}
