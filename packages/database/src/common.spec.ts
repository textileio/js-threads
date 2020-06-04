/* eslint-disable import/first */
// 'Hack' to get WebSocket in the global namespace on nodejs
;(global as any).WebSocket = require('isomorphic-ws')

import path from 'path'
import { expect } from 'chai'
import { Multiaddr, ThreadID, Libp2pCryptoIdentity, ThreadKey } from '@textile/threads-core'
import LevelDatastore from 'datastore-level'
import delay from 'delay'
import { isBrowser } from 'browser-or-node'
import { Key } from 'interface-datastore'
import { DomainDatastore, Dispatcher, Update, Op } from '@textile/threads-store'
import { Network, Client, Context } from '@textile/threads-network'
import { MemoryDatastore } from 'interface-datastore'
import { Database, mismatchError } from './db'
import { EventBus } from './eventbus'
import { threadAddr } from './utils'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const level = require('level')

class Peer {
  constructor(
    public db: Database,
    public threadID: ThreadID,
    public identity: Libp2pCryptoIdentity,
  ) {}
  static init = async () => {
    const db = new Database(new MemoryDatastore())
    const threadID = ThreadID.fromRandom()
    const identity = await Libp2pCryptoIdentity.fromRandom()
    return new Peer(db, threadID, identity)
  }

  public joinFromInvite = async (key: ThreadKey, addr: Multiaddr) => {
    /** Scrap the default db from init */
    this.db = new Database(new MemoryDatastore())
    /** Join the remote db from addr and key */
    await this.db.startFromAddress(this.identity, addr, key)
    if (!this.db.threadID) {
      throw new Error('Expected thread id to exist after invite')
    }
    this.threadID = this.db.threadID
  }

  public getAddr = async (): Promise<Multiaddr> => {
    /**
     * Note: shouldn't this all be a util on the Database?
     */
    const hostID = await this.db.network.getHostID()
    const hostAddr = new Multiaddr('/dns4/threads1/tcp/4006')
    const pa = new Multiaddr(`/p2p/${hostID.toB58String()}`)
    const ta = new Multiaddr(`/thread/${this.threadID.toString()}`)
    const addr = hostAddr.encapsulate(pa.encapsulate(ta))
    return addr
  }
}
describe('Common', () => {
  let remote: Peer
  before(async () => {
    remote = await Peer.init()
  })
  describe('local peer', () => {
    it('create local thread and invite remote peer', async function () {
      /**
       * Use the Peer class above to just create db, threadid and
       * identity all at the same time.
       */
      const local = await Peer.init()
      /**
       * Start the local db with the identity and threadid we already generated,
       */
      await local.db.start(local.identity, { threadID: local.threadID })

      /**
       * Get the required data we need to invite our other peer to the thread.
       *
       * info contains our thread key
       * addr will contain our required network address.
       */
      // const info = await local.db.getInfo()
      // expect(info).to.not.be.undefined
      // expect(info).to.have.property('key')
      // if (!info || !info.key) throw new Error('Expected thread key')
      // const addr = await local.getAddr()
      // expect(addr).to.not.be.undefined
      // await remote.joinFromInvite(info.key, addr)
      expect(remote.threadID).to.deep.equal(local.threadID)
    }).timeout(5000)
  })
})
