import { expect } from 'chai'
import { MemoryDatastore, Key, Result } from 'interface-datastore'
import { collect } from 'streaming-iterables'
import { Dispatcher } from './dispatcher'

interface TestEvent {
  time: number
  entity: string
  collection: string
}

describe('Dispatcher', () => {
  it('should not require any arguments to initialize', async () => {
    const d = new Dispatcher<TestEvent>()
    const value: TestEvent = {
      time: Date.now(),
      entity: 'null',
      collection: 'null',
    }
    await d.dispatch({ key: new Key('key'), value })
  })

  it('should add new (unique) reducers on registration', async () => {
    const d = new Dispatcher<TestEvent>()
    const reducer = { reduce: (..._event: Result<TestEvent>[]) => Promise.resolve(undefined) }
    await d.register(reducer)
    expect(d.reducers).to.have.length(1)
    await d.register(reducer)
    expect(d.reducers).to.have.length(1)
  })

  it('should only dispatch one (set of) events at a time', async () => {
    const d = new Dispatcher<TestEvent>()
    const slowReducer = (..._event: Result<TestEvent>[]) => new Promise<void>(r => setTimeout(r, 2000))
    d.register({ reduce: slowReducer })
    const value: TestEvent = {
      time: Date.now(),
      entity: 'null',
      collection: 'null',
    }
    const t1 = Date.now()
    // Don't await...
    d.dispatch({ key: new Key('one'), value })
    await d.dispatch({ key: new Key('two'), value })
    const t2 = Date.now()
    expect(t2 - t1 + 100).to.be.greaterThan(4000) // Adjust up to catch approx. timings
  }).timeout(5000)

  it('should persist events to the internal store when present', async () => {
    const d = new Dispatcher<TestEvent>(new MemoryDatastore())
    const value: TestEvent = {
      time: Date.now(),
      entity: 'null',
      collection: 'null',
    }
    await d.dispatch({ key: new Key('one'), value })
    await d.dispatch({ key: new Key('two'), value })
    expect(d.store).to.not.be.undefined
    expect(await collect(d.store?.query({}) || [])).to.have.lengthOf(2)
  }).timeout(5000)

  it('should throw on first error', async () => {
    const d = new Dispatcher<TestEvent>()
    const value: TestEvent = {
      time: Date.now(),
      entity: 'null',
      collection: 'null',
    }
    await d.dispatch()
    // Error reducer
    const error = new Error('error')
    const reducer = {
      reduce: (..._event: Result<TestEvent>[]) => Promise.reject(new Error('error')),
    }
    await d.register(reducer)
    try {
      await d.dispatch({ key: new Key('one'), value })
      throw new Error('should have thrown error on dispatch call')
    } catch (err) {
      expect(err.toString()).to.equal(error.toString())
    }
  })

  it('should not be able to register a new reducer while dispatching', async () => {
    const d = new Dispatcher<TestEvent>()
    const slowReducer = (..._event: Result<TestEvent>[]) => new Promise<void>(r => setTimeout(r, 2000))
    await d.register({ reduce: slowReducer })
    const value: TestEvent = {
      time: Date.now(),
      entity: 'null',
      collection: 'null',
    }
    const t1 = Date.now()
    // Don't await...
    d.dispatch({ key: new Key('one'), value })
    await d.register({ reduce: slowReducer })
    const t2 = Date.now()
    expect(t2 - t1).to.be.greaterThan(2000 - 10)
  }).timeout(3000)
})
