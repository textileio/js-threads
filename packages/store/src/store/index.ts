import { Datastore } from 'interface-datastore'
import { EventEmitter } from 'tsee'
import { RWLock } from 'async-rwlock'
import { Dispatcher } from '../dispatcher'
import { Collection } from '../collection'
import { EventCodec } from '../codecs'
import { Block, Action, Event } from '..'

// Events are for the store's EventEmitter
type Events = {
  events: (events: Event[]) => void
  localEvent: (event: Block) => void
  stateChange: (actions: Action[]) => void
}

export type StoreID = string

// Store is the aggregate-root of events and state. External/remote events
// are dispatched to the Store, and are internally processed to impact model
// states. Likewise, local changes in models registered produce events dispatched
// externally.
export interface Interface<T = Buffer> extends EventEmitter<Events> {
  datastore: Datastore<T>
  dispatcher: Dispatcher
  eventCodec: EventCodec
  // threadService: ThreadService
  // adapter: ThreadAdapter

  lock: RWLock
  collections: Map<StoreID, Collection>
  start(): Promise<void>
  stop(): Promise<void>
}

// Options has configuration parameters for a store
export interface Options {
  // repoPath?: string
  datastore?: Datastore
  eventCodec?: EventCodec
  debug?: boolean
}

export { Store } from './store'
