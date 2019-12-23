import { Datastore, Key } from 'interface-datastore'
import { Block } from '@textile/threads-core'

// EntityID is the type used in models identities
export type EntityID = string

export const EmptyEntityID: EntityID = ''

export interface Entity extends Object {
  ID?: EntityID
}

// Event is a local or remote event generated in a model and dispatched by Dispatcher.
export interface Event {
  time: Buffer
  entityID: EntityID
  collection: string // model
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Action {
  // ActionType is the type used by actions done in a txn
  export enum Type {
    // Create indicates the creation of an instance in a txn
    Create = 0,
    // Save indicates the mutation of an instance in a txn
    Save,
    // Delete indicates the deletion of an instance by ID in a txn
    Delete,
  }
}

// Action is a operation done in the model
interface Action<T extends Entity = object> {
  // Type of the action
  type: Action.Type
  // EntityID of the instance in action
  entityID: EntityID
  // ModelName of the instance in action
  collectionName: string // modelName
  // Previous is the instance before the action
  previous?: T
  // Current is the instance after the action was done
  current?: T
}

export { Action }

export interface ReduceAction {
  // Type of the reduced action
  type: Action.Type
  // Model in which action was made
  collection: string // Model
  // EntityID of the instance in reduced action
  entityID: EntityID
}

// EventCodec transforms actions generated in models to events dispatched to thread logs, and viceversa.
export interface EventCodec {
  // Reduce applies generated events into state
  reduce(events: Event[], datastore: Datastore, baseKey: Key): ReduceAction[]
  // Create corresponding events to be dispatched
  create(ops: Action[]): { events: Event[]; block: Block }
  // EventsFromBytes deserializes a ipldformat.Node bytes payload into Events.
  eventsFromBytes(data: Buffer): Event[]
}
