import randomBytes from 'randombytes'
import CID from 'cids'
import Multiaddr from 'multiaddr'
import log from 'loglevel'
import RWLock from 'async-rwlock'
import { EventEmitter } from 'tsee'
import {
  ThreadID,
  LogID,
  LogInfo,
  Block,
  ThreadRecord,
  ThreadInfo,
  Service as Interface,
  ThreadProtocol,
  Network,
  Events,
} from '@textile/threads-core'
import { Datastore } from 'interface-datastore'
import { keys, PrivateKey, PublicKey } from 'libp2p-crypto'
import PeerId, { createFromPubKey } from 'peer-id'
import { LogStore } from '../logstore'

const logger = log.getLogger('service:service')
// MaxPullLimit is the maximum page size for pulling records.
const maxPullLimit = 10_000
// InitialPullInterval is the interval between automatic log pulls.
const initialPullInterval = 1000 // 1 Second
// PullInterval is the interval between automatic log pulls.
const pullInterval = 10_000 // 10 seconds

// Service is an API for working with threads. It also provides a DAG API to the network.
export class Service extends EventEmitter<Events> implements Interface {
  public store: LogStore
  private semaphore: Map<ThreadID, RWLock> = new Map()
  constructor(store: LogStore | Datastore, public host: PeerId, private server: Network) {
    super()
    this.store = store instanceof LogStore ? store : LogStore.fromDatastore(store)
  }
  private getSemaphore(id: ThreadID) {
    let lock = this.semaphore.get(id)
    if (!lock) {
      lock = new RWLock()
      this.semaphore.set(id, lock)
    }
    return lock
  }

  /**
   * CreateThread creates a new set of keys.
   * @param id Thread ID.
   */
  static createThread(id: ThreadID) {
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
    const privKey: PrivateKey = await keys.generateKeyPair('ed25519', 32)
    const id = await createFromPubKey(privKey.public.bytes)
    const addrs: Set<Multiaddr> = new Set([Multiaddr(`/p2p/${log}`)])
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
    // @todo: Right now, this is just a peer-id, eventually, should be a fully libp2p host.
    // await this.host.stop()
  }

  /**
   * Add a thread from a multiaddress.
   * @param addr Multiaddress.
   */
  async addThread(addr: Multiaddr, replicatorKey: Buffer, readKey?: Buffer) {
    const thread = addr.stringTuples().find(([code]) => code === ThreadProtocol.code)
    if (!thread || !thread[1]) return
    const idStr = thread[1].toString()
    const id = ThreadID.fromEncoded(idStr)
    const pid = addr.getPeerId()
    if (!pid) return
    if (pid === this.host.toB58String()) {
      return this.store.threadInfo(id)
    }
    const info: ThreadInfo = {
      id,
      replicatorKey,
      readKey,
    }
    this.store.addThread(info)
    // const threadAddr = new Multiaddr(`/${ThreadProtocol.protocol}/${idStr}`)
    // const peerAddr = addr.decapsulate(threadAddr)
    const logs = await this.server.getLogs(id, replicatorKey)
    // @todo: Ensure we don't overwrite with newer info from owner?
    for (const log of logs) {
      const pubKey = keys.unmarshalPublicKey(log.pubKey.bytes)
      const privKey = log.privKey ? keys.unmarshalPrivateKey(log.privKey.bytes) : undefined
      await this.maybeCreateExternalLog(id, log.id, pubKey, privKey, new Set(log.addrs))
    }
    // Don't await...
    this.pullThread(id).catch(err => {
      logger.error(`Error: Pulling thread ${id.string()}: ${err.toString()}`)
    })
    return this.store.threadInfo(id)
  }

  // PullThread for new records.
  // Logs owned by this host are traversed locally.
  // Remotely addressed logs are pulled from the network.
  async pullThread(id: ThreadID): Promise<void> {
    // const lock = this.getSemaphore(id)
    // if (lock.getState() > 0) {
    //   log.warn(`Pull thread ${id.string()} ignored. Already being pulled`)
    //   return
    // }
    // await lock.writeLock()
    // try {
    //   log.debug(`Pulling thread ${id.string()}...`)
    //   const logs = await this.getLogs(id)
    //   const replicatorKey = await this.store.keys.replicatorKey(id)
    //   if (!replicatorKey) {
    //     throw new Error('replicator key required')
    //   }
    //   // Gather offsets for each log
    //   const offsets = new Map<LogID, CID | undefined>()
    //   for (const log of logs) {
    //     // @todo: As in Go, we should check to see if we have the CID locally in the blockstore
    //     // For now, we're going to assume if we know about it, we have it...
    //     offsets.set(log.id, [...(log.heads || [])].shift())
    //   }
    //   const records: RecordNode[] = []
    //   // @todo: In go, we'd ask all known peers for records, perhaps abstract this out a bit into a Server interface...
    //   const entries = await this.server.getRecords(id, replicatorKey, offsets, maxPullLimit)
    //   for (const entry of entries) {
    //     for (const rec of entry.records) {
    //       await this.putRecord(id, entry.id, rec)
    //     }
    //   }
    // } finally {
    //   lock.unlock()
    // }
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

  // Utitilities

  /**
   * GetLogs returns info about the logs in the given thread.
   * @param id Thread ID.
   */
  async getLogs(id: ThreadID) {
    const logs: LogInfo[] = []
    const info = await this.store.threadInfo(id)
    for (const logID of info.logs || []) {
      const log = await this.store.logInfo(id, logID)
      logs.push(log)
    }
    return logs
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
    info = await Service.createLog(this.host.toB58String())
    await this.store.addLog(id, info)
    return info
  }
  async maybeCreateExternalLog(
    id: ThreadID,
    log: LogID,
    pubKey: PublicKey,
    privKey?: PrivateKey,
    addrs: Set<Multiaddr> = new Set(),
  ) {
    const lock = this.getSemaphore(id)
    await lock.writeLock()
    try {
      const heads = await this.store.heads.get(id, log)
      if (heads.size < 1) {
        const info: LogInfo = {
          id: log,
          pubKey,
          privKey,
          addrs,
          heads,
        }
        await this.store.addLog(id, info)
      }
    } finally {
      lock.unlock()
    }
  }
}
