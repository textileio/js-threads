import { Action, Event, Block, Entity, EntityID } from '../'

export interface ReduceState<T extends Entity = object> {
  state: T | undefined
  action: ReduceAction
}

export interface ReduceAction {
  type: Action.Type
  collection: string
  entityID: EntityID
}

export interface EncodedEvents<T extends Event> {
  events: T[]
  block: Block
}

// EventCodec transforms actions generated in models to events dispatched to thread logs, and viceversa.
export interface EventCodec<E extends Event> {
  // Reduce an event into the existing state
  reduce<T extends Entity = object>(state: T | undefined, event: Event): Promise<ReduceState<T>>
  // Encode Actions into Events to be dispatched
  encode<T extends Entity = object>(actions: Array<Action<T>>): Promise<EncodedEvents<E>>
  // Decode an IPLD Node payload into Events
  decode(block: Block): Promise<Array<E>>
}
