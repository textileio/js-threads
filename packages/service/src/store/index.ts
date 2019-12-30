/* eslint-disable import/no-cycle */
import { ID, Info, LogInfo } from '@textile/threads-core'

export { AddrBook } from './addrbook'
export { HeadBook } from './headbook'
export { KeyBook } from './keybook'
export { MetadataBook } from './metadatabook'
export { ThreadStore } from './threadstore'

export interface LogsThreads {
  // logs returns a list of log IDs for a thread.
  logs(id: ID): Promise<Set<string>>
  // threads returns a list of threads referenced in the book.
  threads(): Promise<Set<ID>>
}

export interface Closer {
  // Datastore can be closed.
  close(): Promise<void>
}
