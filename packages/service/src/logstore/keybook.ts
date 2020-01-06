/* eslint-disable @typescript-eslint/no-var-requires */
import { Datastore, Key } from 'interface-datastore'
import { NamespaceDatastore } from 'datastore-core'
import { Closer, LogsThreads, ThreadID, LogID, PublicKey, PrivateKey } from '@textile/threads-core'

const crypto = require('libp2p-crypto')
const PeerId = require('peer-id')

// Public and private keys are stored under the following db key pattern:
// /threads/keys/<b32 thread id no padding>/<b32 log id no padding>:(pub|priv)
// Follow and read keys are stored under the following db key pattern:
// /threads/keys/<b32 thread id no padding>:(repl|read)
const baseKey = new Key('/thread/keys')
const getKey = (id: ThreadID, log: LogID, suffix?: string) => {
  return new Key(id.string()).child(new Key(suffix ? `${log}:${suffix}` : log))
}

// KeyBook stores log keys.
export class KeyBook implements LogsThreads, Closer {
  constructor(private datastore: Datastore<Buffer>) {
    this.datastore = new NamespaceDatastore(datastore, baseKey)
  }
  // PubKey retrieves the public key of a log.
  async pubKey(id: ThreadID, log: LogID) {
    try {
      const key = await this.datastore.get(getKey(id, log, 'pub'))
      return crypto.keys.unmarshalPublicKey(key) as PublicKey
    } catch (err) {
      return
    }
  }
  // AddPubKey adds a public key under a log.
  async addPubKey(id: ThreadID, log: LogID, pubKey: PublicKey) {
    const key = pubKey.bytes
    const peer = PeerId.createFromB58String(log)
    if (!peer.isEqual(await PeerId.createFromPubKey(key))) {
      throw new Error('Public Key Mismatch')
    }
    return this.datastore.put(getKey(id, log, 'pub'), key)
  }
  // PrivKey retrieves the private key of a log.
  async privKey(id: ThreadID, log: LogID) {
    try {
      const key = await this.datastore.get(getKey(id, log, 'priv'))
      return crypto.keys.unmarshalPrivateKey(key) as PrivateKey
    } catch (err) {
      return
    }
  }
  // AddPrivKey adds a private key under a log.
  async addPrivKey(id: ThreadID, log: LogID, privKey: PrivateKey) {
    const key = privKey.bytes
    const peer = PeerId.createFromB58String(log)
    const check = await PeerId.createFromPrivKey(key)
    if (!peer.isEqual(check)) {
      throw new Error('Private Key Mismatch')
    }
    return this.datastore.put(getKey(id, log, 'priv'), key)
  }
  // ReadKey retrieves the read key of a log.
  async readKey(id: ThreadID) {
    try {
      return this.datastore.get(new Key(id.string()).child(new Key('read')))
    } catch (err) {
      return
    }
  }
  // AddReadKey adds a read key under a log.
  async addReadKey(id: ThreadID, key: Buffer) {
    return this.datastore.put(new Key(id.string()).child(new Key('read')), key)
  }
  // ReplicatorKey retrieves the follow key of a log.
  async replicatorKey(id: ThreadID) {
    try {
      return this.datastore.get(new Key(id.string()).child(new Key('repl')))
    } catch (err) {
      return
    }
  }
  // AddReplicatorKey adds a follow key under a log.
  async addReplicatorKey(id: ThreadID, key: Buffer) {
    return this.datastore.put(new Key(id.string()).child(new Key('repl')), key)
  }

  async threads() {
    const threads = new Set<ThreadID>()
    for await (const { key } of this.datastore.query({
      prefix: baseKey.toString(),
      keysOnly: true,
    })) {
      // We only care about threads we can replicate
      if (key.name() === 'repl') {
        threads.add(ThreadID.fromEncoded(key.parent().toString()))
      }
    }
    return threads
  }

  async logs(id: ThreadID) {
    const logs = new Set<LogID>()
    const q = { keysOnly: true, prefix: id.string() }
    for await (const { key } of this.datastore.query(q)) {
      if (['priv', 'pub'].includes(key.name())) {
        logs.add(key.type())
      }
    }
    return logs
  }
  async close() {
    return this.datastore.close()
  }
}
