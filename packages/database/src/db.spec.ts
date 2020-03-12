import { expect } from 'chai'
import { collect } from 'streaming-iterables'
import { ThreadID } from '@textile/threads-core'
import { Database } from './db'

describe('Database', () => {
  it('basic', done => {
    const db = new Database()
    db.open(ThreadID.fromEncoded('bafk5cxypkuo2mbfcml74uejlpsux4klpgjg73emjq4iaqnc7fsr3b5q')).then(
      () => {
        db.eventBus.on('record', () => {
          console.log('onRecord')
          done()
        })
        db.newCollection('Test', {}).then(Test => {
          const test = new Test({ anything: 'isVald' })
          test.save().then(() => {
            expect(test.ID).to.not.be.undefined
          })
        })
      },
    )
  })
})
