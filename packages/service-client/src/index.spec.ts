/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/first */
// Some hackery to get WebSocket in the global namespace on nodejs
;(global as any).WebSocket = require('isomorphic-ws')

import { expect } from 'chai'
import CID from 'cids'
import { ThreadID, LogID, LogInfo, PrivateKey } from '@textile/threads-core'
import { RecordEncoder } from '@textile/threads-encoding'
// import randomBytes from 'randombytes'
import bs58 from 'bs58'
import { Client } from '.'

const { create } = require('peer-id')

const host = 'http://127.0.0.1:5006'

describe('Client', function() {
  // before(async () => {
  //   const id = await create()
  //   client = new Client(id, host)
  //   console.log(client)
  // })
  describe('.getLogs', () => {
    let client: Client
    let cid: CID
    let log: LogID
    it('Fetch and decode logs from a remote thread service', async () => {
      const id = await create()
      client = new Client(id, host)
      const threadID = ThreadID.fromEncoded('bafk3vxncb3cpgcrfsfntr5livvb47nedwqz32b7a42exfygvwzodwuq')
      const keyStr = '237h63YCQMvswnkxnwrPWvoZU3qz2VihubXSkNSLMmLMReW5b5ZoXiwNx86vP'
      const readStr = '2EdfJy2bVMR324xPvrLeZZQLySiZnxJQcur2ByvHad8BL4jmABEYPhcobkDjt'
      const key = bs58.decode(keyStr)
      try {
        const logs = await client.getLogs(threadID, key)
        log = logs[0].id
        cid = logs[0].heads?.values().next().value
        const recs = await client.getRecords(threadID, key, new Map([[log, cid]]))
        const info: LogInfo = logs[0]
        info.id = id.toB58String()
        info.pubKey = id.privKey.public
        await client.pushLog(threadID, info, key)
        const last = recs
          .filter(rec => rec.records.length > 0)
          .pop()!
          .records.pop()
        if (last) {
          const test = RecordEncoder.decode(last)
          const body = test.body(readStr)
          const newRecord = await RecordEncoder.encode(body, readStr, undefined, id.privKey, keyStr)
          await client.pushRecord(threadID, info.id, newRecord.logRecord)
          expect(true).to.be.true
        } else {
          throw new Error('should have been valid')
        }
      } catch (err) {
        console.log(err)
        expect(false).to.be.true
      }
    })
  })
})
