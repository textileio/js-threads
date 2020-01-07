import { equal } from 'assert'
import { expect } from 'chai'
import { Action, EntityID, Block } from '@textile/threads-core'
import { Codec, Patch, Op } from './jsonpatcher'

type Person = {
  ID: EntityID
  name: string
  age: number
}

const defaultPerson: Person = {
  ID: 'lucas',
  name: 'Lucas',
  age: 7,
}

describe('JSONPatcher', () => {
  let block: Block
  it('should encode actions to events + IPLD DAG', async () => {
    const base = { entityID: 'lucas', collection: 'lucas' }
    const ops = [
      { type: Action.Type.Create, current: defaultPerson },
      { type: Action.Type.Save, previous: defaultPerson, current: { ...defaultPerson, age: 9 } },
      { type: Action.Type.Delete },
    ]
    const actions = ops.map(op => ({ ...base, ...op } as Action<Person>))
    const { events, block } = await Codec.encode(actions)
    expect(events).to.have.length(3)
    let patch = events[0] as Patch
    expect(patch).to.deep.include(base)
    expect(patch.patch).to.haveOwnProperty('type', Op.Type.Create)
    expect(patch.patch).to.haveOwnProperty('entityID', base.entityID)
    expect(patch.patch).to.haveOwnProperty('patch')
    expect(patch.patch.patch).to.deep.equal(defaultPerson)

    patch = events[1] as Patch
    expect(patch).to.deep.include(base)
    expect(patch.patch).to.haveOwnProperty('type', Op.Type.Save)
    expect(patch.patch).to.haveOwnProperty('entityID', base.entityID)
    expect(patch.patch).to.haveOwnProperty('patch')
    expect(patch.patch.patch).to.deep.equal([{ op: 'replace', path: '/age', value: 9 }])

    patch = events[2] as Patch
    expect(patch).to.deep.include(base)
    expect(patch.patch).to.haveOwnProperty('type', Op.Type.Delete)
    expect(patch.patch).to.haveOwnProperty('entityID', base.entityID)
    expect(patch.patch).to.haveOwnProperty('patch')
    expect(patch.patch.patch).to.be.undefined

    // Can't know what the CID will be ahead of time due to time component
    expect(block).to.have.ownProperty('cid')
    expect(block).to.have.ownProperty('data')
  })

  it('should decode events from an IPLD DAG', async () => {
    const base = { entityID: 'lucas', collection: 'lucas' }
    const ops = [
      { type: Action.Type.Create, current: defaultPerson },
      { type: Action.Type.Save, previous: defaultPerson, current: { ...defaultPerson, age: 9 } },
      { type: Action.Type.Delete },
    ]
    const actions = ops.map(op => ({ ...base, ...op } as Action<Person>))
    const { events, block } = await Codec.encode(actions)
    const decoded = await Codec.decode(block)
    expect(decoded).to.deep.equal(events)
  })

  it('should throw on first error', async () => {
    const base = { entityID: 'lucas', collection: 'lucas' }
    const ops = [
      { type: 99, current: defaultPerson },
      { type: Action.Type.Create, current: defaultPerson },
      { type: Action.Type.Delete },
    ]
    const actions = ops.map(op => ({ ...base, ...op } as Action<Person>))
    try {
      await Codec.encode(actions)
      throw new Error('should have thrown unknown action error')
    } catch (err) {
      expect(err.toString()).to.equal('Error: Unkown Action')
    }
  })
  it('should fold (reduce) events into existing state', async () => {
    const base = { entityID: 'lucas', collection: 'lucas' }
    const ops = [
      { type: Action.Type.Create, current: defaultPerson },
      { type: Action.Type.Save, previous: defaultPerson, current: { ...defaultPerson, age: 9 } },
      { type: Action.Type.Delete },
    ]
    const actions = ops.map(op => ({ ...base, ...op } as Action<Person>))
    const { events } = await Codec.encode(actions)
    const states: (Person | undefined)[] = []
    let state: Person | undefined = defaultPerson
    for (const event of events) {
      state = (await Codec.reduce(state, event)).state
      states.push({ ...state } as Person)
    }
    expect(states.pop()).to.be.empty
    expect(states.pop()).to.deep.equal({ ...defaultPerson, age: 9 })
  })
})
