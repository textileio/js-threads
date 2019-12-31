/* eslint-disable @typescript-eslint/no-var-requires */
import { expect } from 'chai'
import { MemoryDatastore } from 'interface-datastore'
import { ID, Variant } from '@textile/threads-core'

import { AddrBook } from './addrbook'

// @todo: Find or create types for this package
const multiaddr = require('multiaddr')

const generateAddrs = (count: number) => {
  return [...Array(count)].map((_, i) => multiaddr(`/ip4/1.1.1.${i}/tcp/1111`))
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

let ab: AddrBook

describe('AddrBook', () => {
  after(async () => {
    await ab.close()
  })
  describe('Adding', () => {
    beforeEach(async () => {
      const mem = new MemoryDatastore()
      ab = new AddrBook(mem, { ttl: 100, frequency: 20 })
    })
    const id = ID.fromRandom(Variant.Raw, 24)
    it('add a single address', async () => {
      const log = 'peer id' + Math.random()
      const addr = generateAddrs(1)[0]
      await ab.put(id, log, 1000 * 60 * 60, addr) // 1 hr
      expect(await ab.get(id, log)).to.deep.equal([addr])
    })
    it('idempotent add single address', async () => {
      const log = 'peer id' + Math.random()
      const addr = generateAddrs(1)[0]
      await ab.put(id, log, 1000 * 60 * 60, addr) // 1 hr
      await ab.put(id, log, 1000 * 60 * 60, addr) // 1 hr
      expect(await ab.get(id, log)).to.have.length(1)
    })
    it('add multiple addresses', async () => {
      const log = 'peer id' + Math.random()
      const addr = generateAddrs(3)
      await ab.put(id, log, 1000 * 60 * 60, ...addr) // 1 hr
      expect(await ab.get(id, log)).to.have.length(3)
    })
    it('idempotent add multiple addresses', async () => {
      const log = 'peer id' + Math.random()
      const addr = generateAddrs(3)
      await ab.put(id, log, 1000 * 60 * 60, ...addr) // 1 hr
      await ab.put(id, log, 1000 * 60 * 60, ...addr) // 1 hr
      expect(await ab.get(id, log)).to.have.length(3)
    })
    it('adding an existing address with a later expiration extends its ttl', async () => {
      const log = 'peer id' + Math.random()
      const addr = generateAddrs(3)
      await ab.put(id, log, 200, ...addr) // 1 sec
      // same address as before but with a higher TTL
      await ab.put(id, log, 200 * 60, addr[2]) // 1 min
      // after the initial TTL has expired, check that only the third address is present.
      await sleep(300)
      expect(await ab.get(id, log)).to.have.length(1)
      // make sure we actually set the TTL
      await ab.put(id, log, 0)
      expect(await ab.get(id, log)).to.have.length(0)
    })
    it('adding an existing address with an earlier expiration never reduces the expiration', async () => {
      const log = 'peer id' + Math.random()
      const addr = generateAddrs(3)
      await ab.put(id, log, 100 * 60, ...addr) // 1 min
      expect(await ab.get(id, log)).to.have.length(3)
      // same address as before but with a shorter TTL
      await ab.put(id, log, 100, addr[2]) // 1 sec
      // after the initial TTL has expired, check that all three addresses are still present (i.e. the TTL on
      // the modified one was not shortened)
      await sleep(210)
      expect(await ab.get(id, log)).to.have.length(3)
    })
    it('adding an existing address with an earlier expiration never reduces the TTL', async () => {
      const log = 'peer id' + Math.random()
      const addr = generateAddrs(1)[0]
      await ab.put(id, log, 4 * 100, addr)
      // 4 units left
      await sleep(300)
      // 1 unit left
      await ab.put(id, log, 3 * 100, addr)
      // 3 units left
      await sleep(200)
      // 1 unit left
      // We still have the address
      expect(await ab.get(id, log)).to.have.length(1)
      // The TTL wasn't reduced
      await ab.put(id, log, 0)
      expect(await ab.get(id, log)).to.have.length(0)
    })
  })
  describe('Clearing', () => {
    const id = ID.fromRandom(Variant.Raw, 24)
    beforeEach(async () => {
      ab = new AddrBook(new MemoryDatastore(), { ttl: 3600, frequency: 30 })
    })
    it('clearing out addresses should always work', async () => {
      const logs = [...Array(2)].map((_, i) => 'peer id' + Math.random())
      const addr = generateAddrs(5)
      await ab.put(id, logs[0], 100 * 60, ...addr.slice(0, 3))
      await ab.put(id, logs[1], 100 * 60, ...addr.slice(3, 5))
      expect(await ab.get(id, logs[0])).to.deep.equal(addr.slice(0, 3))
      expect(await ab.get(id, logs[1])).to.deep.equal(addr.slice(3))
      await ab.clear(id, logs[0])

      expect(await ab.get(id, logs[0])).to.have.length(0)
      expect(await ab.get(id, logs[1])).to.deep.equal(addr.slice(3))
      await ab.clear(id, logs[1])
      expect(await ab.get(id, logs[0])).to.have.length(0)
      expect(await ab.get(id, logs[1])).to.have.length(0)
    })
  })
})
