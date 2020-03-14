import { expect } from 'chai'
import { collect } from 'streaming-iterables'
import { ThreadID, Multiaddr } from '@textile/threads-core'
import delay from 'delay'
import { Key } from 'interface-datastore'
import { DomainDatastore } from '@textile/threads-store'
import { Service, Client } from '@textile/threads-service'
import { MemoryDatastore } from 'interface-datastore'
import { Database } from './db'
import { threadAddr } from './utils'

interface DummyEntity {
  ID: string
  name: string
  counter: number
}

describe('Database', () => {
  it.skip('should handle an end to end test', async () => {
    // Peer 1: Create db1, register a collection, create and update an instance.
    const d1 = new Database() // All defaults
    await d1.open()
    const id1 = d1.threadID
    if (id1 === undefined) {
      throw new Error('should not be invalid thread id')
    }
    // Create a new collection
    const Dummy1 = await d1.newCollectionFromObject<DummyEntity>('dummy', {
      ID: '',
      name: '',
      counter: 0,
    })

    // Boilerplate to generate peer1 thread-addr
    const hostID = await d1.service.getHostID()
    const hostAddr = new Multiaddr('/dns4/threads1/tcp/4006')
    const addr = threadAddr(hostAddr, hostID.toB58String(), id1.string())

    // Peer 2: Create a completely parallel db2, which will sync with the previous one and should
    // have the same state of dummy.
    const info = await d1.service.getThread(id1)
    const datastore = new MemoryDatastore()
    const client = new Client({ host: 'http://127.0.0.1:5207' })
    const service = new Service(new DomainDatastore(datastore, new Key('service')), client)
    const d2 = await Database.fromAddress(addr, info.replicatorKey, info.readKey, datastore, {
      service,
    })
    // Create parallel collection
    const Dummy2 = await d2.newCollectionFromObject<DummyEntity>('dummy', {
      ID: '',
      name: '',
      counter: 0,
    })

    const dummy1 = new Dummy1({ name: 'Textile', counter: 0 })
    dummy1.counter += 42
    await dummy1.save()

    await delay(6000)
    const dummy2 = await Dummy2.findById(dummy1.ID)
    expect(dummy2.name).to.equal(dummy1.name)
    expect(dummy2.counter).to.equal(dummy1.counter)
  }).timeout(10000)
})
