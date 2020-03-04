import { expect } from 'chai'
import { MemoryDatastore, Key } from 'interface-datastore'
import { collect } from 'streaming-iterables'
import { Dispatcher } from '../dispatcher'
import { BasicStore } from './basic'

describe('BasicStore', () => {
  it('basic', async () => {
    const mStore = new MemoryDatastore()
    const store = new BasicStore(mStore, new Key('test'), new Dispatcher(mStore))
    // dispatcher.register(store)
    store.on('events', console.log)
    store.on('update', console.log)
    await store.put(new Key('hello'), 'world')

    const mRes = await collect(mStore.query({}))
    const nRes = await collect(store.query({}))

    expect(nRes).to.have.length(1)
    expect(mRes).to.have.length(1)

    expect(nRes).to.have.length(mRes.length)
    await store.close()
  })
})
