import CID from 'cids'
import PeerId from 'peer-id'
import { ThreadID } from '../thread'
import { Block } from '../ipld'
import { Event } from './event'

/**
 * LogRecord is an Block node representing a record.
 */
export interface LogRecord {
  /**
   * The node structure of the record.
   */
  value: Block<Uint8Array>
  /**
   * The underlying event block.
   */
  block: Event
  /**
   * The underlying record node.
   */
  obj?: RecordNode
}

/**
 * Node defines the node structure of a record.
 */
export interface RecordNode {
  /**
   * Signature of current and previous blocks.
   */
  sig: Uint8Array
  /**
   * CID of record block.
   */
  block: CID
  /**
   * CID of previous record.
   */
  prev?: CID
}

/**
 * ThreadRecord wraps a LogRecord within a thread and log context.
 */
export interface ThreadRecord {
  /**
   * The underlying LogRecord.
   */
  record?: LogRecord
  /**
   * The Thread to which this record belongs.
   */
  threadID: ThreadID
  /**
   * To Log to which this record belongs.
   */
  logID: PeerId
}
