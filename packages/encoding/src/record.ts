import CID from 'cids'
import { Block } from '@textile/threads-core'
import { randomBytes, PrivateKey } from 'libp2p-crypto'
import { Options, defaultOptions, encodeBlock, decodeBlock } from './coding'
import { Event, EventNode } from './event'

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
 * EncodedRecord is a serialized version of a record that contains link data.
 */
export interface EncodedRecord {
  recordnode: Uint8Array | string
  eventnode: Uint8Array | string
  headernode: Uint8Array | string
  bodynode: Uint8Array | string
}

// CreateRecord returns a new record from the given block and log private key.
export async function createRecord(
  data: Event,
  privKey: PrivateKey,
  prev?: CID,
  key?: Uint8Array,
  opts: Options = defaultOptions,
) {
  const block = await data.value.cid()
  let payload = block.buffer
  if (prev && CID.isCID(prev)) {
    payload = Buffer.concat([payload, prev.buffer])
  }
  const sig = await privKey.sign(payload)
  const obj: RecordNode = {
    block,
    sig,
  }
  // Don't include prev unless it is defined
  if (prev) obj.prev = prev
  const node = Block.encoder(obj, opts.codec, opts.algo)
  const keyiv = key || randomBytes(44)
  const value = encodeBlock(node, keyiv, opts)
  // @todo: We don't support a dag here yet, but this is where we'd add this data to IPFS!
  const record: LogRecord = {
    value,
    obj,
    block: data,
  }
  return record
}

// RecordToProto returns a proto version of a record for transport.
// Nodes are sent encrypted.
export function recordToProto(rec: LogRecord) {
  const event = rec.block
  const eventnode = event.value.encodeUnsafe().toString('base64')
  const headernode = event.header.encodeUnsafe().toString('base64')
  const bodynode = event.body.encodeUnsafe().toString('base64')
  const recordnode = rec.value.encodeUnsafe().toString('base64')
  const record: EncodedRecord = {
    eventnode,
    headernode,
    bodynode,
    recordnode,
  }
  return record
}

// recordFromProto returns a node from a serialized version that contains link data.
export function recordFromProto(proto: EncodedRecord, keyiv: Uint8Array, opts: Options = defaultOptions) {
  const rawRecord = Buffer.from(proto.recordnode as string, 'base64')
  const rnode = Block.decoder<Buffer>(rawRecord, opts.codec, opts.algo)
  const rawEvent = Buffer.from(proto.eventnode as string, 'base64')
  const enode = Block.decoder<EventNode>(rawEvent, opts.codec, opts.algo)
  const rawHeader = Buffer.from(proto.headernode as string, 'base64')
  const hnode = Block.decoder<Uint8Array>(rawHeader, opts.codec, opts.algo)
  const rawBody = Buffer.from(proto.bodynode as string, 'base64')
  const body = Block.decoder<Uint8Array>(rawBody, opts.codec, opts.algo)
  const decoded = decodeBlock(rnode, keyiv)
  const robj = decoded.decode()
  const eobj = enode.decode()
  enode.encode() // Created encoded value
  body.encode()
  hnode.encode()
  const evt: Event = {
    value: enode,
    header: hnode,
    body: body,
    obj: eobj,
  }
  const rec: LogRecord = {
    value: rnode,
    obj: robj,
    block: evt,
  }
  return rec
}
