import { ThreadID, LogInfo, LogID } from '@textile/threads-core'

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
interface LogEntry {
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
  // getRecords(id: ThreadID, log: LogID, replicatorKey: Buffer, opts: { offset: CID; limit: number }): Promise<LogEntry>
  // PushRecord to a peer.
  // pushRecord(id: ThreadID, log: LogID, record: Record): Promise<void>
}
