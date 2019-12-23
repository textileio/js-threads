import { expect } from 'chai'
import { pack } from 'lexicographic-integer'
import { Dispatcher } from './dispatcher'
import { Event } from '.'

describe('Dispatcher', () => {
  it('should not require any arguments to initialise', async () => {
    const d = new Dispatcher()
    const event: Event = {
      time: Buffer.from(pack(Date.now())),
      entityID: 'null',
      collection: 'null',
    }
    await d.dispatch(event)
    // @todo: Should we check something here?
  })

  it('should add new (unique) reducers on registration', async () => {
    const d = new Dispatcher()
    const reducer = { reduce: async (...event: Event[]) => undefined }
    await d.register(reducer)
    expect(d.reducers).to.have.length(1)
    await d.register(reducer)
    expect(d.reducers).to.have.length(1)
  })

  it('should only dispatch one (set of) events at a time', async () => {
    const d = new Dispatcher()
    const slowReducer = async (..._event: Event[]) => new Promise<void>(r => setTimeout(r, 2000))
    d.register({ reduce: slowReducer })
    const event: Event = {
      time: Buffer.from(pack(Date.now())),
      entityID: 'null',
      collection: 'null',
    }
    const t1 = Date.now()
    // Don't await...
    d.dispatch(event)
    await d.dispatch(event)
    const t2 = Date.now()
    expect(t2 - t1).to.be.greaterThan(4000)
  }).timeout(5000)

  it('should throw on first error', async () => {
    const d = new Dispatcher()
    const event: Event = {
      time: Buffer.from(pack(Date.now())),
      entityID: 'null',
      collection: 'null',
    }
    await d.dispatch(event)
    // Error reducer
    const reducer = {
      reduce: async (...event: Event[]) => {
        throw new Error('error')
      },
    }
    await d.register(reducer)
    try {
      await d.dispatch(event)
      throw new Error('should have thrown error on dispatch call')
    } catch (err) {
      expect(err.toString()).to.equal('Error: error')
    }
  })

  it('should not be able to register a new reducer while dispatching', async () => {
    const d = new Dispatcher()
    const slowReducer = async (..._event: Event[]) => new Promise<void>(r => setTimeout(r, 2000))
    await d.register({ reduce: slowReducer })
    const event: Event = {
      time: Buffer.from(pack(Date.now())),
      entityID: 'null',
      collection: 'null',
    }
    const t1 = Date.now()
    // Don't await...
    d.dispatch(event)
    await d.register({ reduce: slowReducer })
    const t2 = Date.now()
    expect(t2 - t1).to.be.greaterThan(2000 - 10)
  }).timeout(3000)
})
