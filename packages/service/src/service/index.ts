/* eslint-disable @typescript-eslint/no-var-requires */
import randomBytes from 'randombytes'
import CID from 'cids'
import { EventEmitter } from 'tsee'
import { ThreadID, LogID, LogInfo, Multiaddr, PrivateKey, Block, ThreadRecord, ThreadInfo } from '@textile/threads-core'
import { LogStore } from '../logstore'

// @todo: Factor out libp2p crypto and peer-id
const crypto = require('libp2p-crypto')
const PeerId = require('peer-id')
const multiaddr = require('multiaddr')

export type Events = {
  record: (record: ThreadRecord) => void
}

// Service is an API for working with threads. It also provides a DAG API to the network.
// @todo: This implements the Closer interface. Should probably import and indicate that here.
export class Service extends EventEmitter<Events> {
  // @todo: Host is currently left as 'any'. Should probably be typed to PeerId.
  constructor(public store: LogStore, public host: any /**, dag: DAGService*/) {
    super()
  }

  /**
   * CreateThread creates a new set of keys.
   * @param id Thread ID.
   */
  static async createThread(id: ThreadID) {
    const replicatorKey = randomBytes(44)
    const readKey = randomBytes(44)
    const info: ThreadInfo = {
      id,
      replicatorKey,
      readKey,
    }
    return info
  }

  /**
   * CreateLog creates a new log with the given log id.
   * @param log
   */
  static async createLog(log: LogID) {
    const privKey: PrivateKey = await crypto.keys.generateKeyPair('ed25519', 32)
    const id = await PeerId.createFromPubKey(privKey.public)
    const addrs: Set<Multiaddr> = new Set([multiaddr(`/p2p/${log}`)])
    const info: LogInfo = {
      id,
      pubKey: privKey.public,
      privKey,
      addrs,
    }
    return info
  }

  async close() {
    this.removeAllListeners()
    await this.store.close()
    // @todo: Make sure this is a valid method call
    await this.host.stop()
  }

  /**
   * Add a thread from a multiaddress.
   * @param addr Multiaddress.
   */
  async addThread(addr: Multiaddr, replicatorKey: Buffer, readKey?: Buffer): Promise<ThreadInfo> {
    throw new Error('not implemented')
  }

  // PullThread for new records.
  async pullThread(id: ThreadID): Promise<void> {
    // @fixme: Implement this.
    throw new Error('not implemented')
  }
  // DeleteThread with id.
  async deleteThread(id: ThreadID): Promise<void> {
    // @fixme: Implement this.
    throw new Error('not implemented')
  }

  /**
   * Add a replicator to a thread.
   * @param id Thread ID.
   * @param peer Peer to act as replicator.
   */
  async addReplicator(id: ThreadID, peer: string) {
    // @fixme: Implement this.
    throw new Error('not implemented')
  }

  // AddRecord with body.
  addRecord(id: ThreadID, body: Block): Promise<ThreadRecord> {
    // @fixme: Implement this.
    throw new Error('not implemented')
  }
  // GetRecord returns the record at cid.
  getRecord(id: ThreadID, rid: CID): Promise<ThreadRecord> {
    // @fixme: Implement this.
    throw new Error('not implemented')
  }

  /**
   * GetLog returns the log with the given thread and log id.
   * @param id Thread ID.
   * @param log Log ID.
   */
  async getLog(id: ThreadID, log: LogID) {
    return await this.store.logInfo(id, log)
  }
  /**
   * GetOwnLoad returns the log owned by the host under the given thread.
   * @param id Thread ID.
   */
  async getOwnLog(id: ThreadID) {
    const logs = await this.store.logs(id)
    for (const log of logs) {
      const sk = this.store.keys.privKey(id, log)
      if (sk) return this.store.logInfo(id, log)
    }
    return
  }
  /**
   * GetOrCreateOwnLoad returns the log owned by the host under the given thread.
   * If no log exists, a new one is created under the given thread.
   * @param id Thread ID.
   */
  async getOrCreateOwnLog(id: ThreadID) {
    let info = await this.getOwnLog(id)
    if (info) return info
    info = await Service.createLog(this.host.id())
    await this.store.addLog(id, info)
    return info
  }
}
