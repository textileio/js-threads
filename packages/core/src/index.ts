import Buffer from 'buffer'
import CID from 'cids'

export * from './thread'
export * from './service'
export * from './external'

export interface Block {
  data: Buffer
  cid: CID
}
