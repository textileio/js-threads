/* eslint-disable @typescript-eslint/no-var-requires */
import { expect } from 'chai'
import { MemoryDatastore } from 'interface-datastore'
import { ThreadID, Variant } from '@textile/threads-core'
import Multiaddr from 'multiaddr'
import crypto, { PrivateKey } from 'libp2p-crypto'
import PeerId from 'peer-id'
import { LogStore } from './logstore'

const createLogStore = () => {
  return LogStore.fromDatastore(new MemoryDatastore())
}

const createPeerAndKey = async () => {
  const privKey: PrivateKey = await crypto.keys.generateKeyPair('rsa', 1024)
  const log = await PeerId.createFromPrivKey(privKey.bytes)
  return log.toB58String()
}

const generateAddrs = (count: number) => {
  return [...Array(count)].map((_, i) => Multiaddr(`/ip4/1.1.1.${i}/tcp/1111`))
}

describe('LogStore', () => {
  let store: LogStore
  beforeEach(() => {
    store = createLogStore()
  })
  it('should initialize with a set of books and then close', async () => {
    await store.close()
    expect(store).to.have.ownProperty('keys')
    expect(store).to.have.ownProperty('addrs')
    expect(store).to.have.ownProperty('heads')
    expect(store).to.have.ownProperty('metadata')
  })
  it('should be able to access underlying threads and logs', async () => {
    const addrs = generateAddrs(10)
    const ids = []
    for (const addr of addrs) {
      const id = ThreadID.fromRandom(Variant.Raw, 24)
      const log = await createPeerAndKey()
      ids.push(id)
      await store.addrs.put(id, log, Infinity, addr)
    }
    const threads = await store.threads()
    expect(threads.size).to.equal(10)
    const logs = await store.logs(ids[0])
    expect(logs.size).to.equal(1)
  })
})
