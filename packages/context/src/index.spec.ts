import { expect } from 'chai'
import { Context, expirationError } from './index'

describe('Context', () => {
  it('should throw an exception when working with an expired msg', async () => {
    try {
      const context = new Context()
      context.withAPISig({
        sig: 'fake',
        // Create msg date in the past
        msg: new Date(Date.now() - 1000 * 60).toUTCString(),
      })
      context.toJSON()
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).to.equal(expirationError)
    }
  })
})
