// import Libp2p from 'libp2p'
// import { DAGService } from '@textile/ipfs-lite'
// import { Multiaddr } from 'multiaddr'
// import Block from 'ipld-block'
// import CID from 'cids'
// import { ThreadStore } from '../threadstore'
// import { Info } from '../thread/info'
// import { Record as ThreadRecord } from '../thread/record'
// import { ID } from '../thread/id'
// import { AddOptions } from './options'

// // Threadservice is an API for working with threads. It also provides a DAG API to the network.
// export interface ThreadService extends DAGService, EventSource {
//   // Host provides a network identity.
//   host: Libp2p
//   // Store persists thread details.
//   store: ThreadStore
//   // AddThread from a multiaddress.
//   addThread(addr: Multiaddr): Info
//   // PullThread for new records.
//   // Logs owned by this host are traversed locally.
//   // Remotely addressed logs are pulled from the network.
//   pullThread(id: ID): void
//   // Delete a thread.
//   deleteThread(id: ID): void
//   // AddFollower to a thread.
//   addFollower(id: ID, pid: string): void
//   // AddRecord with body. See AddOption for more.
//   addRecord(body: Block, opts?: AddOptions): Record
//   // GetRecord returns the record at cid.
//   getRecord(id: ID, lid: string, rid: CID): ThreadRecord
// }

// // Record wraps a thread Record within a thread and log context.
// export interface Record {
//   // Value returns the underlying record.
//   value: ThreadRecord
//   // ThreadID returns the record's thread ID.
//   threadID: ID
//   // LogID returns the record's log ID.
//   logID: string
// }
