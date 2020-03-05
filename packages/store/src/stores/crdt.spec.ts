import { expect } from 'chai'
import { MemoryDatastore, Key } from 'interface-datastore'
import { collect } from 'streaming-iterables'
import CRDT from 'delta-crdts'
import uuid from 'uuid'
import { Dispatcher } from '../dispatcher'
import { CRDT as CRDTType, CRDTStore } from './crdt'

describe('CRDTStore', () => {
  it('basic', async () => {
    const mvreg1: CRDTType = CRDT('mvreg')(uuid())

    const mStore = new MemoryDatastore()
    const store = new CRDTStore(mStore, new Key('test'), new Dispatcher(mStore), 'mvreg')

    let count = 0
    store.on('events', () => count++)
    store.on('update', () => count++)

    await store.put(new Key('hello'), mvreg1)

    const mRes = await collect(mStore.query({}))
    const nRes = await collect(store.query({}))

    expect(nRes).to.have.length(1)
    expect(mRes).to.have.length(2) // The dispatcher _and_ event
    expect(count).to.equal(2)

    const reg1 = await store.get(new Key('hello'))
    reg1.write('world')
    await store.put(new Key('hello'), reg1)

    const mvreg2: CRDTType = CRDT('mvreg')(uuid())
    mvreg2.write('everyone') // Creates 'conflict'
    await store.put(new Key('hello'), mvreg2)

    const reg2 = await store.get(new Key('hello'))
    expect(reg2.value()).to.deep.equal(new Set(['world', 'everyone']))

    await store.close()
  })
})
