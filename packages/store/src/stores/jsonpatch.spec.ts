import { expect } from 'chai'
import { MemoryDatastore, Key } from 'interface-datastore'
import { collect } from 'streaming-iterables'
import uuid from 'uuid'
import { Dispatcher } from '../dispatcher'
import { JsonPatchStore } from './jsonpatch'

describe('JsonPatchStore', () => {
  it('basic', async () => {
    const mStore = new MemoryDatastore()
    const store = new JsonPatchStore(mStore, new Key('test'), new Dispatcher())

    let count = 0
    store.on('events', () => count++)
    store.on('update', () => count++)

    await store.put(new Key('bar'), { ID: uuid(), hello: 'world' })

    const mRes = await collect(mStore.query({}))
    const nRes = await collect(store.query({}))

    expect(nRes).to.have.length(1)
    expect(mRes).to.have.length(1)

    expect(count).to.equal(2)
    await store.close()
  })
})
