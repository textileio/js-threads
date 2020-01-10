/* eslint-disable @typescript-eslint/no-var-requires */
import Base58 from 'bs58'
import CID from 'cids'
import { LinkRecord, EventHeader, RecordNode, EventNode, PrivateKey } from '@textile/threads-core'
import { decodeBlock, CodecOptions, createEvent, defaultCodecOpts, encodeBlock } from './crypto/node'

const Block = require('@ipld/block')

export { CodecOptions }

export class RecordEncoder {
  constructor(public logRecord: LinkRecord, private opts: CodecOptions = defaultCodecOpts) {}
  /**
   * Create new Record from existing LogRecord
   * @param record The input LogRecord
   * @param opts The encoding options to use when decoding the data from IPLD blocks.
   */
  static decode(record: LinkRecord, opts: CodecOptions = defaultCodecOpts) {
    return new RecordEncoder(record, opts)
  }
  /**
   * Create new Record from a raw input body.
   * @param obj The input data to encode into a Record.
   * @param readKey The required symmetric read key.
   * @param key The optional symmetric key to use to encrypt the raw body data.
   * @param opts The encoding options to use when encoding the data as IPLD blocks.
   */
  static async encode(
    obj: any,
    readKey: string,
    key?: string,
    privKey?: PrivateKey,
    followKey?: string,
    prev?: CID,
    opts: CodecOptions = defaultCodecOpts,
  ) {
    const { body, header } = await createEvent(obj, readKey, key, opts)
    const event = {
      body: await body.cid(),
      header: await header.cid(),
    }
    const codedEvent = Block.encoder(event, opts.codec, opts.algo)
    const record: LinkRecord = {
      event: codedEvent.encode().toString('base64'),
      body: body.encode().toString('base64'),
      header: header.encode().toString('base64'),
    }

    const block = await codedEvent.cid()
    let payload: Buffer = block.buffer
    if (prev) {
      payload = Buffer.concat([payload, prev.buffer])
    }
    const sig = (await privKey?.sign(payload)) || Buffer.from('')
    const rec: RecordNode = { block, sig }
    if (prev) rec.prev = prev
    const encoded = encodeBlock(rec, followKey).encode()
    record.record = encoded.toString('base64')
    return new RecordEncoder(record, opts)
  }
  header(readKey: string) {
    if (this.logRecord.header) {
      const headerNode = this.logRecord.header
      const headerRaw = headerNode instanceof Buffer ? headerNode : Buffer.from(headerNode, 'base64')
      const header = decodeBlock(headerRaw, readKey, this.opts)
      return header as EventHeader
    }
    return undefined
  }
  body(readKey: string) {
    const head = this.header(readKey)
    if (this.logRecord.body && head) {
      const key = Base58.encode(head.key)
      const bodyNode = this.logRecord.body
      const bodyRaw = bodyNode instanceof Buffer ? bodyNode : Buffer.from(bodyNode, 'base64')
      const body = decodeBlock(bodyRaw, key, this.opts)
      return body
    }
    return undefined
  }
  event() {
    if (this.logRecord.event) {
      const eventNode = this.logRecord.event
      const eventRaw = eventNode instanceof Buffer ? eventNode : Buffer.from(eventNode, 'base64')
      // Event 'body' is not encrypted, so don't use decodeBlock
      const event = Block.decoder(eventRaw, this.opts.codec, this.opts.algo).decode()
      return event as EventNode
    }
    return undefined
  }
  record(followKey: string) {
    if (this.logRecord.record) {
      const recordNode = this.logRecord.record
      const recordRaw = recordNode instanceof Buffer ? recordNode : Buffer.from(recordNode, 'base64')
      const record = decodeBlock(recordRaw, followKey, this.opts)
      return record as RecordNode
    }

    return undefined
  }
}
