import { ID, LogInfo, Info } from '@textile/threads-core'
import { KeyBook, AddrBook, HeadBook, MetadataBook, Closer } from '.'

// ThreadStore is a collection of books for storing threads.
interface Interface extends Closer {
  keys: KeyBook
  addrs: AddrBook
  metadata: MetadataBook
  heads: HeadBook
  // Threads returns all threads in the store.
  threads(): Promise<Array<ID>>
  // ThreadInfo returns info about a thread.
  threadInfo(id: ID): Promise<Info>
  // AddLog adds a log to a thread.
  addLog(id: ID, info: LogInfo): Promise<void>
  // LogInfo returns info about a log.
  logInfo(id: ID, log: string): Promise<LogInfo>
}

export class ThreadStore implements Interface {
  constructor(public keys: KeyBook, public addrs: AddrBook, public metadata: MetadataBook, public heads: HeadBook) {}

  async close() {
    return
  }
  // Threads returns all threads in the store.
  async threads() {
    return []
  }
  // ThreadInfo returns info about a thread.
  async threadInfo(id: ID) {
    return {} as Info
  }
  // AddLog adds a log to a thread.
  async addLog(id: ID, info: LogInfo) {
    return
  }
  // LogInfo returns info about a log.
  async logInfo(id: ID, log: string) {
    return {} as LogInfo
  }
}
