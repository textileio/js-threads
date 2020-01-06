import { EventEmitter } from 'events'
import CID from 'cids'
import { LogID, ThreadID, LogInfo, ThreadInfo } from '../thread'
import { Multiaddr } from '../external'
import { Closer, Block } from '../utils'

export interface ThreadRecord {
  value: RecordNode
  threadID: ThreadID
  logID: LogID
}

export interface RecordNode {
  sig: Buffer
  prev: CID
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

export interface Service extends Closer, EventEmitter {
  store: LogStore
  host: any
  // dag: DAGService
  close(): Promise<void>
  addThread(addr: Multiaddr, replicatorKey: Buffer, readKey?: Buffer): Promise<ThreadInfo>
  pullThread(id: ThreadID): Promise<void>
  deleteThread(id: ThreadID): Promise<void>
  addReplicator(id: ThreadID, peer: string): Promise<void>
  addRecord(id: ThreadID, body: Block): Promise<ThreadRecord>
  getRecord(id: ThreadID, rid: CID): Promise<ThreadRecord>
}

// Record is a thread record containing link data.
export interface Record {
  // recordNode is the top-level node's raw data.
  recordNode: Buffer
  // eventNode is the event node's raw data.
  eventNode: Buffer
  // headerNode is the header node's raw data.
  headerNode: Buffer
  // bodyNode is the body node's raw data.
  bodyNode: Buffer
}

// Log represents a thread log.
export interface Log {
  // ID of the log.
  id: Uint8Array | string
  // pubKey of the log.
  pubkey: Uint8Array | string
  // addrs of the log.
  addrsList: Array<Uint8Array | string>
  // heads of the log.
  headsList: Array<Uint8Array | string>
}

// LogEntry represents a single log.
export interface LogEntry {
  // logID of this entry.
  ID: LogID
  // records returned for this entry.
  records: Record[]
  // log contains new log info that was missing from the request.
  log: Log
}

export interface Network {
  // GetLogs from a peer.
  getLogs(id: ThreadID, replicatorKey: Buffer): Promise<Log[]>
  // PushLog to a peer.
  pushLog(id: ThreadID, log: LogInfo, replicatorKey: Buffer, readKey?: Buffer): Promise<void>
  // GetRecords from a peer.
  getRecords(id: ThreadID, log: LogID, replicatorKey: Buffer, opts: { offset: CID; limit: number }): Promise<LogEntry>
  // PushRecord to a peer.
  pushRecord(id: ThreadID, log: LogID, record: Record): Promise<void>
}
