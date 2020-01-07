/* eslint-disable @typescript-eslint/no-var-requires */
import { expect } from 'chai'
import { MemoryDatastore } from 'interface-datastore'
import { ThreadID, PrivateKey } from '@textile/threads-core'
import { KeyBook } from './keybook'

// @todo: Find or write type defs for these (or replace them with smaller deps)
const crypto = require('libp2p-crypto')
const PeerId = require('peer-id')

let kb: KeyBook
const tid: ThreadID = ThreadID.fromRandom(0, 24)

describe('KeyBook', () => {
  before(() => {
    const mem = new MemoryDatastore()
    kb = new KeyBook(mem)
  })
  after(async () => {
    await kb.close()
  })
  it('PrivKey', async () => {
    const privKey: PrivateKey = await crypto.keys.generateKeyPair('rsa', 1024)
    expect(privKey).to.not.be.undefined

    const log = await PeerId.createFromPrivKey(privKey.bytes)
    const logId = log.toB58String()

    // No privkey exists yet
    const key = await kb.privKey(tid, logId)
    expect(key).to.be.undefined

    // Add should not err
    const res = await kb.addPrivKey(tid, logId, privKey)
    expect(res).to.be.undefined

    // Stored priv key should match
    const que = await kb.privKey(tid, logId)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(que!.bytes).to.deep.equal(privKey!.bytes)

    const logs = await kb.logs(tid)
    expect(Array.from(logs)).to.contain(logId)
  })
  it('PubKey', async () => {
    const privKey: PrivateKey = await crypto.keys.generateKeyPair('rsa', 1024)
    expect(privKey).to.not.be.undefined

    const log = await PeerId.createFromPubKey(privKey.public.bytes)
    const logId = log.toB58String()

    // No pubKey exists yet
    const key = await kb.pubKey(tid, logId)
    expect(key).to.be.undefined

    // Add should not err
    const res = await kb.addPubKey(tid, logId, privKey.public)
    expect(res).to.be.undefined

    // Stored priv key should match
    const que = await kb.pubKey(tid, logId)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(que!.bytes).to.deep.equal(privKey!.public.bytes)

    const logs = await kb.logs(tid)
    expect(Array.from(logs)).to.contain(logId)
  })
  it('ReadKey', async () => {
    // No readKey exists yet
    const key = await kb.readKey(tid)
    expect(key).to.be.undefined

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
    const key = await kb.replicatorKey(tid)
    expect(key).to.be.undefined

    const key128 = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])

    // Add should not err
    const res = await kb.addReplicatorKey(tid, key128)
    expect(res).to.be.undefined

    // Stored read key should match
    const que = await kb.replicatorKey(tid)
    expect(que).to.equal(key128)
  })
})
