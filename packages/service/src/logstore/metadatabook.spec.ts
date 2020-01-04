import { expect } from 'chai'
import { MemoryDatastore } from 'interface-datastore'
import { ThreadID } from '@textile/threads-core'
import { MetadataBook } from './metadatabook'

let book: MetadataBook
const id: ThreadID = ThreadID.fromRandom(0, 24)

describe('MetadataBook', () => {
  beforeEach(async () => {
    const mem = new MemoryDatastore()
    book = new MetadataBook(mem)
  })
  after(async () => {
    await book.close()
  })
  it('Put&Get', async () => {
    const key = 'key1'
    const value = 'textile'
    await book.put(id, key, value)
    const res = await book.get(id, key)
    expect(res.toString()).to.equal(value)
  })
  it('Not Found', async () => {
    const key = 'keyNA'
    try {
      const res = await book.get(id, key)
      throw new Error('should have thrown')
    } catch (err) {
      expect(err.toString()).to.equal('Error: Not Found')
    }
  })
})
