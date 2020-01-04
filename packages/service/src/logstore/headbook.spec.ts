/* eslint-disable @typescript-eslint/no-var-requires */
import { expect } from 'chai'
import CID from 'cids'
import { MemoryDatastore } from 'interface-datastore'
import { ThreadID } from '@textile/threads-core'
import { HeadBook } from './headbook'

// @todo: Find or write the types for this library
const PeerId = require('peer-id')

let hb: HeadBook
const id: ThreadID = ThreadID.fromRandom(0, 24)
const peer = new PeerId(Buffer.from('test peer'))

describe('HeadBook', () => {
  beforeEach(async () => {
    const mem = new MemoryDatastore()
    hb = new HeadBook(mem)
  })
  after(async () => {
    await hb.close()
  })
  it('Put Heads', async () => {
    const heads: CID[] = [new CID('QmcfJ7FHfjBFD5ga3nLsxvdShcrnqQeEm6vaqByqd6BZMi')]

    await hb.put(id, peer.toB58String(), ...heads)

    const hbHeads = await hb.get(id, peer.toB58String())
    expect(hbHeads.size).to.equal(1)

    for (const head of hbHeads) {
      expect(head.toV0().toString()).to.equal('QmcfJ7FHfjBFD5ga3nLsxvdShcrnqQeEm6vaqByqd6BZMi')
    }
  })

  it('Add Heads', async () => {
    const heads: CID[] = [
      new CID('QmcfJ7FHfjBFD5ga3nLsxvdShcrnqQeEm6vaqByqd6BZMi'),
      new CID('QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D'),
    ]

    await hb.add(id, peer.toB58String(), ...heads)

    const hbHeads = await hb.get(id, peer.toB58String())
    expect(hbHeads.size).to.equal(2)

    expect(hbHeads).to.deep.equal(new Set(heads))
  })

  it('Clear Heads', async () => {
    await hb.clear(id, peer.toB58String())
    try {
      const hbHeads = await hb.get(id, peer.toB58String())
      throw new Error('should have throw "Not Found" error')
    } catch (err) {
      expect(err.toString()).to.equal('Error: Not Found')
    }
  })
})
