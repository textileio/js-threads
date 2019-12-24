import { Action, Event, Block } from '../'
// eslint-disable-next-line import/no-cycle
import * as JSONPatcher from './jsonpatcher'

export { JSONPatcher }

export interface EncodedEvents {
  events: Event[]
  block: Block
}

// EventCodec transforms actions generated in models to events dispatched to thread logs, and viceversa.
export interface EventCodec {
  // Reduce applies generated events into state
  // reduce(events: Event[], datastore: Datastore, baseKey: Key): ReduceAction[]
  // Encode corresponding events to be dispatched
  encode(actions: Action[]): Promise<EncodedEvents>
  // Decode deserializes a ipldformat.Node bytes payload into Events.
  decode(block: Block): Promise<Array<Event>>
}
