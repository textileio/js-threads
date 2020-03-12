import { expect } from 'chai'
import { MemoryDatastore, Key } from 'interface-datastore'
import { collect } from 'streaming-iterables'
import { Dispatcher } from '../dispatcher'
import { BasicStore } from './basic'

describe('BasicStore', () => {
  describe('interface-datastore', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('interface-datastore/src/tests')({
      setup() {
        return new BasicStore(new MemoryDatastore())
      },
      teardown() {
        return
      },
    })
  })

  it('basic', async () => {
    const mStore = new MemoryDatastore()
    const store = new BasicStore(mStore, new Key('test'), new Dispatcher(mStore))

    let count = 0
    store.on('events', () => count++)
    store.on('update', () => count++)

    await store.put(new Key('hello'), 'world')

    const mRes = await collect(mStore.query({}))
    const nRes = await collect(store.query({}))

    expect(nRes).to.have.length(1)
    expect(mRes).to.have.length(2) // The dispatcher _and_ event
    expect(count).to.equal(2)

    await store.close()
  })
})
