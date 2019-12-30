/* eslint-disable @typescript-eslint/no-var-requires */
import { expect } from 'chai'
import { MemoryDatastore } from 'interface-datastore'
import { ID, PrivateKey } from '@textile/threads-core'
import { KeyBook } from './keybook'

const crypto = require('libp2p-crypto')
const PeerId = require('peer-id')

let kb: KeyBook
const tid: ID = ID.newRandom(0, 24)
const peer = new PeerId(Buffer.from('test peer'))

describe('KeyBook', () => {
  before(async () => {
    const mem = new MemoryDatastore()
    kb = new KeyBook(mem)
  })
  after(async () => {
    await kb.close()
  })
  it('PrivKey', async () => {
    const privKey: PrivateKey | undefined = await crypto.keys.generateKeyPair('rsa', 1024)
    if (privKey === undefined) {
      expect(privKey).to.not.be.undefined
      return
    }

    const log = await PeerId.createFromPrivKey(privKey.bytes)
    const logId = log.toB58String()

    // No privkey exists yet
    try {
      const err = await kb.privKey(tid, logId)
      throw new Error('should have rejected')
    } catch (err) {
      expect(err.toString()).to.equal('Error: Not Found')
    }

    // Add should not err
    const res = await kb.addPrivKey(tid, logId, privKey)
    expect(res).to.equal(undefined)

    // Stored priv key should match
    const que = await kb.privKey(tid, logId)
    expect(que.bytes).to.deep.equal(privKey.bytes)

    const logs = await kb.logs(tid)
    expect(Array.from(logs)).to.contain(logId)
  })
  it('PubKey', async () => {
    const privKey: PrivateKey | undefined = await crypto.keys.generateKeyPair('rsa', 1024)
    if (privKey === undefined) {
      expect(privKey).to.not.be.undefined
      return
    }

    const log = await PeerId.createFromPubKey(privKey.public.bytes)
    const logId = log.toB58String()

    // No pubKey exists yet
    try {
      const err = await kb.pubKey(tid, logId)
      throw new Error('should have rejected')
    } catch (err) {
      expect(err.toString()).to.equal('Error: Not Found')
    }

    // Add should not err
    const res = await kb.addPubKey(tid, logId, privKey.public)
    expect(res).to.equal(undefined)

    // Stored priv key should match
    const que = await kb.pubKey(tid, logId)
    expect(que.bytes).to.deep.equal(privKey.public.bytes)

    const logs = await kb.logs(tid)
    expect(Array.from(logs)).to.contain(logId)
  })
  it('ReadKey', async () => {
    // No readKey exists yet
    try {
      const err = await kb.readKey(tid)
      throw new Error('should have rejected')
    } catch (err) {
      expect(err.toString()).to.equal('Error: Not Found')
    }

    const key128 = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])

    // Add should not err
    const res = await kb.addReadKey(tid, key128)
    expect(res).to.be.undefined

    // Stored read key should match
    const que = await kb.readKey(tid)
    expect(que).to.equal(key128)
  })

  it('ReplicatorKey', async () => {
    // No readKey exists yet
    try {
      const err = await kb.replicatorKey(tid)
      throw new Error('should have rejected')
    } catch (err) {
      expect(err.toString()).to.equal('Error: Not Found')
    }

    const key128 = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])

    // Add should not err
    const res = await kb.addReplicatorKey(tid, key128)
    expect(res).to.be.undefined

    // Stored read key should match
    const que = await kb.replicatorKey(tid)
    expect(que).to.equal(key128)
  })
})
