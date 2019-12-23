import { Datastore } from 'interface-datastore'
import { EventEmitter } from 'tsee'
import { RWLock } from 'async-rwlock'
import { Dispatcher } from './dispatcher'
import { Collection } from './collection'
import { EventCodec } from '.'

// Define our store events
type Events = {
  events: (events: any[]) => void
}

// Store is the aggregate-root of events and state. External/remote events
// are dispatched to the Store, and are internally processed to impact model
// states. Likewise, local changes in models registered produce events dispatched
// externally.
export interface Store<T = Buffer> extends EventEmitter<Events> {
  datastore: Datastore<T>
  dispatcher: Dispatcher
  eventCodec: EventCodec
  // threadService: ThreadService
  // adapter: ThreadAdapter

  lock: RWLock
  collections: Record<string, Collection>
}
