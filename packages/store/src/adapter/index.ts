import { RWLock } from 'async-rwlock'
import { Store } from '../store'

// SingleThreadAdapter connects a Store with a Threadservice
export interface ThreadAdapter {
  // api: ThreadService
  store: Store
  threadID: string // @todo: Not a string
  logID: string
  lock: RWLock
  started: boolean
  closed: boolean
  // Close closes the storehead and stops listening both directions of thread<->store
  close(): Promise<void>
  // Start starts connection from Store to Threadservice, and viceversa
  start(): Promise<void>
}
