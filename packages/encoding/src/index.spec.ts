/* eslint-disable @typescript-eslint/no-var-requires */
import Base58 from 'bs58'
import { expect } from 'chai'
import CID from 'cids'
import { RecordEncoder } from '.'

const { create } = require('peer-id')

const input = {
  // record:
  // 'WLQ/rImARp9uZ2dw0tU12DgQDRyT3J/Wwj0rt7I739loFIzYPE82pjZS9tMFVrDvgXsMXU/XAn2z41E6TIqzPbM6/VkKMcru0oEe5VnEmzLRDbYOmBr9Uho7x/KbeWpXfm8GUu+viBBwktuVFz0Gm4Z74UaVwuUVQTCKim7YH/zbPM7QkhbBRQy/DQdn2rQPFRmsJAgd7Fydo4KG+icYcHT1mzilfqOm4nyUvYmQXvPLNqU1xy4=',
  event:
    'omRib2R52CpYJQABcRIgwu4jIXV2zvNPD3OJpkkx9PYNn/RqwsEKAfBZwgsqkblmaGVhZGVy2CpYJQABcRIg7uOMHiwnnEeIECpLwtE12mkoc5RAqn+lxEYtXeiTpfM=',
  header:
    'WE2oKDx5XsA/9FVKesyrFTXBKmA5mLXf3Vemu58u5zTh8NjmViDIvYFGdPti1vwDr85QMmiCPMlfpscRLYyyoqAJor6mstTvYypnv3AZKg==',
  body: 'WCG7M6xYU4Z6APHvGVItlP40JsEhjNorfduruomEVDGYcHc=',
}

const readKey = 'ZH8u8CenXXHVCxRPzWGugV3DHsP3vRmD4F6UhHqocpYFbX2r81BRnd4tbDSq'
const followKey = 'gmpuqCBn8MBSNC5MYtpnAsTHWFRu2wyTGaDrjTHYjJBWCt9snfv4s3vsExTJ'
const key = '29EApHMhnc1uRsxpppSijtWzTjWLBPD6MKErUKxDpD6gK7rjbMf6fHcus4VLf'
const prev = 'bafyreid6loscdsu5cse3taj5766upazcdmzzdymq5afrrat3ysdnp6ucda'

describe('Record...', () => {
  let newInput: any
  it('should encode and encrypt a log record', async () => {
    const id = await create()
    const privKey = id.privKey
    const record = await RecordEncoder.encode({ txt: 'hello world' }, readKey, key, privKey, followKey, new CID(prev))
    const h = record.header(readKey)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(h!.key).to.deep.equal(Base58.decode(key))
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(h!.time).to.be.lessThan(new Date().valueOf())
    const b = record.body(readKey)
    expect(b.txt).to.equal('hello world')
    const e = record.event()
    const r = record.record(followKey)
    expect(r).to.have.ownProperty('sig')
    expect(e).to.have.ownProperty('body')
    newInput = record.logRecord
  })
  it('should decode and decrypt a log record', () => {
    const record = RecordEncoder.decode(newInput)
    const h = record.header(readKey)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(h!.key).to.deep.equal(Base58.decode(key))
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(h!.time).to.be.lessThan(new Date().valueOf())
    const b = record.body(readKey)
    expect(b.txt).to.equal('hello world')
    const e = record.event()
    const r = record.record(followKey)
    expect(r).to.have.ownProperty('sig')
    expect(e).to.have.ownProperty('body')
  })
})
