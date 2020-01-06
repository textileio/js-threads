import { Datastore } from 'interface-datastore'
import { ThreadID, LogID, LogInfo, ThreadInfo, LogStore as Interface } from '@textile/threads-core'
import { KeyBook } from './keybook'
import { AddrBook } from './addrbook'
import { HeadBook } from './headbook'
import { MetadataBook } from './metadatabook'

export class LogStore implements Interface {
  constructor(public keys: KeyBook, public addrs: AddrBook, public metadata: MetadataBook, public heads: HeadBook) {}
  static fromDatastore(store: Datastore<Buffer>) {
    return new LogStore(new KeyBook(store), new AddrBook(store), new MetadataBook(store), new HeadBook(store))
  }

  async close() {
    await this.keys.close()
    await this.addrs.close()
    await this.metadata.close()
    await this.heads.close()
    return
  }
  /**
   * Threads returns all threads in the store.
   */
  async threads() {
    const keys = await this.keys.threads()
    const addrs = await this.addrs.threads()
    const threads = new Set([...keys, ...addrs])
    return threads
  }
  /**
   * Logs returns all logs under the given thread.
   * @param id Thread ID.
   */
  async logs(id: ThreadID) {
    const keys = await this.keys.logs(id)
    const addrs = await this.addrs.logs(id)
    const logs = new Set([...keys, ...addrs])
    return logs
  }
  /**
   * AddThread adds a thread with keys.
   * @param info Thread information.
   */
  async addThread(info: ThreadInfo) {
    if (!info.replicatorKey) {
      throw new Error('Replicate Key Required')
    }
    await this.keys.addReplicatorKey(info.id, info.replicatorKey)
    info.readKey && (await this.keys.addReadKey(info.id, info.readKey))
  }
  /**
   * ThreadInfo returns info about a thread.
   * @param id Thread ID.
   */
  async threadInfo(id: ThreadID) {
    const logs = await this.logs(id)
    const replicatorKey = await this.keys.replicatorKey(id)
    const readKey = await this.keys.readKey(id)
    const info: ThreadInfo = {
      id,
      logs,
      replicatorKey,
      readKey,
    }
    return info
  }
  /**
   * AddLog adds a log to a thread.
   * @param id Thread ID.
   * @param info Log information.
   */
  async addLog(id: ThreadID, info: LogInfo) {
    await this.keys.addPubKey(id, info.id, info.pubKey)
    info.privKey && (await this.keys.addPrivKey(id, info.id, info.privKey))
    await this.addrs.put(id, info.id, Infinity, ...(info.addrs || []))
    await this.heads.put(id, info.id, ...(info.heads || []))
    return
  }
  /**
   * LogInfo returns info about a log.
   * @param id Thread ID.
   * @param log Log ID.
   */
  async logInfo(id: ThreadID, log: LogID) {
    const pubKey = await this.keys.pubKey(id, log)
    if (!pubKey) throw new Error('Public Key Missing')
    const privKey = await this.keys.privKey(id, log)
    const addrs = await this.addrs.get(id, log)
    const heads = await this.heads.get(id, log)
    const info: LogInfo = {
      id: log,
      pubKey,
      privKey,
      addrs,
      heads,
    }
    return info
  }
}
