/* eslint-disable import/first */
;(global as any).WebSocket = require('isomorphic-ws')

import {
  ThreadInfo,
  ThreadRecord,
  Multiaddr,
  ThreadID,
  ThreadKey,
  Libp2pCryptoIdentity,
} from '@textile/threads-core'
import { Context } from '@textile/context'
import { Client } from '@textile/threads-network-client'
import { MemoryDatastore } from 'interface-datastore'
import { Network } from '.'

let info: ThreadInfo
const proxyAddr1 = 'http://127.0.0.1:6007'
const proxyAddr2 = 'http://127.0.0.1:6207'

async function createThread(client: Network | Client) {
  const id = ThreadID.fromRandom(ThreadID.Variant.Raw, 32)
  const threadKey = ThreadKey.fromRandom()
  return client.createThread(id, { threadKey })
}

;(async function () {
  const client = new Network(new MemoryDatastore(), new Client(new Context(proxyAddr1)))
  // const client = new Client(new Context(proxyAddr1))
  await client.getToken(await Libp2pCryptoIdentity.fromRandom())

  // const client2 = new Network(new MemoryDatastore(), new Client(new Context(proxyAddr2)))
  const client2 = new Client(new Context(proxyAddr2))
  const hostID2 = await client2.getHostID()
  const hostAddr2 = new Multiaddr(`/dns4/threads2/tcp/4006`)
  const peerAddr = hostAddr2.encapsulate(new Multiaddr(`/p2p/${hostID2}`))
  info = await createThread(client)
  await client.addReplicator(info.id, peerAddr)
  // Create temporary identity
  const identity = await Libp2pCryptoIdentity.fromRandom()
  await client2.getToken(identity)

  let count = 0
  let timeOne = 0
  const res = client2.subscribe(
    (rec?: ThreadRecord, err?: Error) => {
      if (rec) count += 1
      if (err) throw new Error(`unexpected error: ${err.toString()}`)
      if (count >= 2) {
        res.close()
        console.log(Date.now() - timeOne)
        process.exit()
      }
    },
    [info.id],
  )
  timeOne = Date.now()
  client.createRecord(info.id, { foo: 'bar1' }).then(() => {
    console.log(Date.now() - timeOne)
    client.createRecord(info.id, { foo: 'bar2' }).then(() => {
      console.log(Date.now() - timeOne)
    })
  })
})()
