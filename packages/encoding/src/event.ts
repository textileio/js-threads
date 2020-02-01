import { randomBytes } from 'libp2p-crypto'
import { Block } from '@textile/threads-core'
import CID from 'cids'
import { Options, defaultOptions, encodeBlock } from './coding'

/**
 * Event is a Block node representing an event.
 */
export interface Event {
  /**
   * The node structure of the event.
   */
  value: Block<EventNode>
  /**
   * The header content for the event.
   */
  header: Block<Uint8Array>
  /**
   * The body content for the event.
   */
  body: Block<Uint8Array>
  /**
   * The underlying event node.
   */
  obj?: EventNode
}

/**
 * Node defines the node structure of an event.
 */
export interface EventNode {
  /**
   * CID of body block
   */
  body: CID
  /**
   * CID of header block
   */
  header: CID
}

/**
 * Header defines the node structure of an event header.
 */
export interface EventHeader {
  /**
   * Single-use symmetric key
   */
  key?: Uint8Array
  /**
   * Unix seconds since epoch
   */
  time: number
}

export async function createEvent(body: Block, readKey: Uint8Array, key?: Uint8Array, opts: Options = defaultOptions) {
  const keyiv = key || randomBytes(44)
  const codedBody = encodeBlock(body, keyiv)
  const header: EventHeader = {
    key: keyiv,
    time: Math.round(new Date().getTime() / 1000),
  }
  const eventHeader = Block.encoder(header, opts.codec, opts.algo)
  const codedHeader = encodeBlock(eventHeader, readKey, opts)
  // Encode to create the caches
  codedBody.encode()
  codedHeader.encode()
  const obj: EventNode = {
    body: await codedBody.cid(),
    header: await codedHeader.cid(),
  }
  const codedEvent = Block.encoder(obj, opts.codec, opts.algo)
  codedEvent.encode()
  // @todo: We don't support a dag here yet, but this is where we'd add this data to IPFS!
  // @todo: Do we need to encode the values here, rather than letting the encoder do it later?
  const event: Event = {
    value: codedEvent,
    header: codedHeader,
    body: codedBody,
  }
  return event
}
