/* eslint-disable @typescript-eslint/no-var-requires */
import CID from 'cids'
import { Datastore, Key } from 'interface-datastore'
import { NamespaceDatastore } from 'datastore-core'
import { ID } from '@textile/threads-core'
import { encode, decode } from 'cbor-sync'
import { Closer } from '.'

// /thread/heads/<base32 thread id no padding>/<base32 log id no padding>
const baseKey = new Key('/thread/heads')
const getKey = (id: ID, log: string) => new Key(id.string()).child(new Key(log))

export class HeadBook implements Closer {
  constructor(private datastore: Datastore<Buffer>) {
    this.datastore = new NamespaceDatastore(datastore, baseKey)
  }
  // Get retrieves head values for a log.
  async get(id: ID, log: string) {
    const res = await this.datastore.get(getKey(id, log))
    const heads: Buffer[] = decode(res)
    return heads.map((buf: Buffer) => new CID(buf))
  }
  // put datastores cid in a log's head.
  async put(id: ID, log: string, ...cids: CID[]) {
    // @todo: This could lead to duplicate entries...
    return this.datastore.put(getKey(id, log), encode(cids.map(cid => cid.buffer)))
  }
  // Add appends a new head to a log.
  async add(id: ID, log: string, ...cids: CID[]) {
    let arr: CID[] = []
    try {
      const res = await this.datastore.get(getKey(id, log))
      arr = decode(res).map((buf: Buffer) => new CID(buf))
    } catch (err) {
      // ignore
    }
    const update = new Set(arr)
    for (const cid of cids) {
      update.add(cid)
    }
    return this.put(id, log, ...update)
  }

  // Clear deletes the head entry for a log.
  async clear(id: ID, log: string) {
    return this.datastore.delete(getKey(id, log))
  }

  async close() {
    return this.datastore.close()
  }
}
