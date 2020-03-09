import { expect } from 'chai'
import { Collection } from './collection'

describe('Collection', () => {
  it('basic', async () => {
    interface Blah {
      ID: string
      other?: number
      thing: string
    }
    const Test = new Collection('blah', {})
    const orig: Blah = { ID: '123', thing: 'one' }
    // @todo: Figure out how to avoid "object is not a constructor" errors
    const blah = Test(orig)
    expect(blah.thing).to.equal('one')
    blah.other = 5
    // blah.more = 'something'
    expect(blah.other).to.equal('nothing')
    await blah.save()
  })
})
