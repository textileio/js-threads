import { RWLock } from 'async-rwlock'
import { ThreadID, LogID, Event, Entity, Service } from '@textile/threads-core'

// eslint-disable-next-line import/no-cycle
import { Store } from '../store'

// SingleThreadAdapter connects a Store with a Threadservice
export class Adapter<E extends Event, T extends Entity> {
  private api: Service
  private logID: LogID = ''
  private lock: RWLock = new RWLock()
  private started = false
  private closed = false
  constructor(private store: Store<E, T>, private threadID: ThreadID) {
    this.api = store.service
  }
  // Close closes the storehead and stops listening both directions of thread<->store
  async close(): Promise<void> {
    // @todo: implement me!
    throw new Error('not implemented')
  }
  // Start starts connection from Store to Threadservice, and viceversa
  async start(): Promise<void> {
    // @todo: implement me!
    throw new Error('not implemented')
  }
}
