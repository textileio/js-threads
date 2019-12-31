/* eslint-disable @typescript-eslint/no-var-requires */
import { Datastore, Key } from 'interface-datastore'
import { NamespaceDatastore } from 'datastore-core'
import { ID } from '@textile/threads-core'
import { encode, decode } from 'cbor-sync'
import { Closer } from '.'

// /thread/heads/<base32 thread id no padding>/<base32 log id no padding>
const baseKey = new Key('/thread/meta')
const getKey = (id: ID, log: string) => new Key(id.string()).child(new Key(log))

// Metadata stores local thread metadata like name.
export class MetadataBook implements Closer {
  constructor(private datastore: Datastore<Buffer>) {
    this.datastore = new NamespaceDatastore(datastore, baseKey)
  }
  // get retrieves a value under the given key.
  async get(id: ID, key: string) {
    return decode(await this.datastore.get(getKey(id, key)))
  }
  // put stores a value under a given key.
  async put(id: ID, key: string, val: any) {
    return this.datastore.put(getKey(id, key), encode(val))
  }
  async close() {
    return this.datastore.close()
  }
}
