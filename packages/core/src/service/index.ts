import EventEmitter from 'events'
import CID from 'cids'
import Multiaddr from 'multiaddr'
import { LogID, ThreadID, LogInfo, ThreadInfo } from '../thread'
import { Closer, Block } from '../utils'
// @todo: Replace this with actual peer-id types
import { PeerID } from '../external'

export interface ThreadRecord {
  value: RecordNode
  threadID: ThreadID
  logID: LogID
}

export interface RecordNode {
  sig: Buffer | string
  prev?: CID
  block: CID
}

// @todo: Add all the books
export interface LogStore extends Closer {
  close(): Promise<void>
  threads(): Promise<Set<ThreadID>>
  logs(id: ThreadID): Promise<Set<LogID>>
  addThread(info: ThreadInfo): Promise<void>
  threadInfo(id: ThreadID): Promise<ThreadInfo>
  addLog(id: ThreadID, info: LogInfo): Promise<void>
  logInfo(id: ThreadID, log: string): Promise<LogInfo>
}

export type Events = {
  record: (record: ThreadRecord) => void
}

export interface Service extends EventEmitter, Closer {
  store: LogStore
  host: PeerID
  // dag: DAGService
  close(): Promise<void>
  addThread(addr: Multiaddr, replicatorKey: Buffer, readKey?: Buffer): Promise<ThreadInfo | undefined>
  pullThread(id: ThreadID): Promise<void>
  deleteThread(id: ThreadID): Promise<void>
  addReplicator(id: ThreadID, peer: string): Promise<void>
  addRecord(id: ThreadID, body: Block): Promise<ThreadRecord | undefined>
  getRecord(id: ThreadID, rid: CID): Promise<ThreadRecord | undefined>
}

export interface EventHeader {
  key: Buffer
  time: number
}

export interface EventNode {
  header: any
  body: any
}

// LinkRecord is a thread record containing link data.
export interface LinkRecord {
  // recordNode is the top-level node's raw data.
  record?: Buffer | string
  // eventNode is the event node's raw data.
  event: Buffer | string
  // headerNode is the header node's raw data.
  header: Buffer | string
  // bodyNode is the body node's raw data.
  body: Buffer | string
}

// LogEntry represents a single log.
export interface LogEntry {
  // logID of this entry.
  id: LogID
  // records returned for this entry.
  records: LinkRecord[]
  // log contains new log info that was missing from the request.
  log?: LogInfo
}

export interface Network {
  // GetLogs from a peer.
  getLogs(id: ThreadID, replicatorKey: Buffer): Promise<LogInfo[]>
  // PushLog to a peer.
  pushLog(id: ThreadID, log: LogInfo, replicatorKey: Buffer, readKey?: Buffer): Promise<void>
  // GetRecords from a peer.
  getRecords(
    id: ThreadID,
    replicatorKey: Buffer,
    offsets?: Map<LogID, CID | undefined>,
    limit?: number,
  ): Promise<LogEntry[]>
  // PushRecord to a peer.
  pushRecord(id: ThreadID, log: LogID, record: LinkRecord): Promise<void>
}
