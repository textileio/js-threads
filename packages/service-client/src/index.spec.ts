/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/first */
// Some hackery to get WebSocket in the global namespace on nodejs
;(global as any).WebSocket = require('isomorphic-ws')

import { expect } from 'chai'
import { ThreadID, PeerID } from '@textile/threads-core'
import randomBytes from 'randombytes'
import { Client } from '.'

const { create } = require('peer-id')

const host = 'http://127.0.0.1:5006'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

describe.skip('Client', function() {
  let client: Client
  before(async () => {
    const peerID: PeerID = await create()
    client = new Client(peerID.toB58String(), host)
    console.log(client)
  })
  describe('.init', () => {
    it('something else here', async () => {
      console.log(client)
      const id = ThreadID.fromRandom()
      const key = randomBytes(44)
      try {
        await client.getLogs(id, key)
        expect(true).to.be.true
      } catch (err) {
        console.log(err)
        expect(false).to.be.true
      }
    })
  })
})
