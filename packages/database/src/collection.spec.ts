import { expect } from 'chai'
import { collect } from 'streaming-iterables'
import { Collection, existingKeyError } from './collection'

describe('Collection', () => {
  it('basic', async () => {
    interface Info {
      ID: string;
      other?: number;
      thing: string;
    }
    const Thing = new Collection<Info>('things', {})
    const data: Info = { ID: '123', thing: 'one' }
    const thing1 = new Thing(data)
    expect(thing1.thing).to.equal('one')
    thing1.other = 1
    // thing1.more = 'something' // Won't compile unless type can have additional properties
    expect(thing1.other).to.equal(1)
    expect(await collect(Thing.find({}))).to.have.length(0)
    await thing1.save() // Now saved to collection
    expect(await collect(Thing.find({}))).to.have.length(1)
    await Thing.save(data)
    try {
      await Thing.insert(data)
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).to.equal(existingKeyError)
    }
    await Thing.insert(
      { ID: '', other: 2, thing: 'two' },
      { ID: '', other: 3, thing: 'three' },
      { ID: '', other: 4, thing: 'four' },
    )
    const all = await collect(Thing.find({}, { sort: { other: -1 } }))
    const last = all[0]
    expect(last.value).to.have.haveOwnProperty('other', 4)
  })
})
