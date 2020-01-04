import CID from 'cids'
import { LogID, ThreadID } from '../thread'

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
