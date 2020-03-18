import { expect } from 'chai'
import { Multiaddr, ThreadID, Variant } from '@textile/threads-core'
import LevelDatastore from 'datastore-level'
import delay from 'delay'
import { Datastore, Key } from 'interface-datastore'
import { DomainDatastore, Dispatcher, Update, Op } from '@textile/threads-store'
import { Service, Client } from '@textile/threads-service'
import { MemoryDatastore } from 'interface-datastore'
import { Database } from './db'
import { EventBus } from './eventbus'
import { threadAddr } from './utils'

interface DummyEntity {
  ID: string
  name: string
  counter: number
}

/**
 * Runs a complex db use-case, and returns events received according to the provided options.
 * @param los: The action path to listen on. Paths are structured as: <collection>.<id>.<type>,
 * and support whildcards. For example, <collection>.*.* will listen to all events for a given
 * collection. Double wildcard (**) is recursive, so <collection>.** will also listen to call
 * events on a collection. Similarly, ** listens to all events on all collections.
 */
async function runListenersComplexUseCase(los: string[]) {
  const db = new Database() // Use the defaults
  const Collection1 = await db.newCollectionFromObject<DummyEntity>('Collection1', {
    ID: '',
    name: '',
    counter: 0,
  })

  const Collection2 = await db.newCollectionFromObject<DummyEntity>('Collection2', {
    ID: '',
    name: '',
    counter: 0,
  })

  // Create some instance *before* any listener, just to test that it doesn't appear on a
  // listener's "stream".
  const i1 = new Collection1({ ID: 'id-i1', name: 'Textile1' })
  await i1.save()
  await delay(1000)

  const events: Update[] = []
  // @todo: Should we wrap this in a 'listen' method instead?
  for (const name of los) {
    db.emitter.on(name, update => {
      events.push(update)
    })
  }

  // Collection1 save i1
  i1.name = 'Textile0'
  await i1.save()

  // Collection1 create i2
  const i2 = new Collection1({ ID: 'id-i2', name: 'Textile2' })
  await i2.save()

  // Collection2 create j1
  const j1 = new Collection2({ ID: 'id-j1', name: 'Textile3' })
  await j1.save()

  // Collection1 save i1
  // Collection1 save i2
  await Collection1.writeTransaction(async c => {
    i1.counter = 30
    i2.counter = 11
    await c.save(i1, i2)
  })

  // Collection2 save j1
  j1.counter = -1
  j1.name = 'Textile33'
  await j1.save()

  // Collection1 delete i1
  await Collection1.delete(i1.ID)

  // Collection2 delete j1 (use alternate API)
  await j1.remove()

  // Collection2 delete i2
  await Collection1.delete(i2.ID)

  db.emitter.removeAllListeners()
  await db.close()
  // Expected generated actions:
  // Collection1 Save i1
  // Collection1 Create i2
  // Collection2 Create j1
  // Save i1
  // Save i2
  // Collection2 Save j1
  // Delete i1
  // Collection2 Delete j1
  // Delete i2
  return events
}

describe('Database', () => {
  describe('end to end test', () => {
    it.skip('should allow paired peers to exchange updates', async () => {
      // @todo This test is probably too slow for CI, but should run just fine locally
      // Should probably just skip it (https://stackoverflow.com/a/48121978) in CI
      // Peer 1: Create db1, register a collection, create and update an instance.
      const d1 = new Database() // All defaults
      await d1.open()
      const id1 = d1.threadID
      if (id1 === undefined) {
        throw new Error('should not be invalid thread id')
      }
      // Create a new collection
      const Dummy1 = await d1.newCollectionFromObject<DummyEntity>('dummy', {
        ID: '',
        name: '',
        counter: 0,
      })

      // Boilerplate to generate peer1 thread-addr
      const hostID = await d1.service.getHostID()
      const hostAddr = new Multiaddr('/dns4/threads1/tcp/4006')
      const addr = threadAddr(hostAddr, hostID.toB58String(), id1.string())

      // Peer 2: Create a completely parallel db2, which will sync with the previous one and should
      // have the same state of dummy.
      const info = await d1.service.getThread(id1)
      const datastore = new MemoryDatastore()
      const client = new Client({ host: 'http://127.0.0.1:5207' })
      const service = new Service(new DomainDatastore(datastore, new Key('service')), client)
      const d2 = await Database.fromAddress(addr, info.replicatorKey, info.readKey, datastore, {
        service,
      })
      // Create parallel collection
      const Dummy2 = await d2.newCollectionFromObject<DummyEntity>('dummy', {
        ID: '',
        name: '',
        counter: 0,
      })

      const dummy1 = new Dummy1({ name: 'Textile', counter: 0 })
      dummy1.counter += 42
      await dummy1.save()

      await delay(6000)
      const dummy2 = await Dummy2.findById(dummy1.ID)
      expect(dummy2.name).to.equal(dummy1.name)
      expect(dummy2.counter).to.equal(dummy1.counter)
      await d1.close()
      await d2.close()
    }).timeout(10000)
  })

  describe('basic', () => {
    let datastore: Datastore
    before(async () => {
      datastore = new LevelDatastore('tmp.db')
      // Otherwise previous runs will create invalid ids
      await (datastore as any).db.clear()
    })

    it('should work with a persistent database and custom options', async () => {
      const dispatcher = new Dispatcher(new DomainDatastore(datastore, new Key('dispatcher')))
      const service = new Service(new DomainDatastore(datastore, new Key('service')), new Client())
      const eventBus = new EventBus(new DomainDatastore(datastore, new Key('eventbus')), service)
      const db = new Database(datastore, { dispatcher, service, eventBus })

      const id = ThreadID.fromRandom(Variant.Raw, 32)
      await db.open(id)

      await db.newCollectionFromObject<DummyEntity>('dummy', {
        ID: '',
        name: '',
        counter: 0,
      })
      // Re-do again to re-use id. If something wasn't closed correctly, would fail
      await db.close() // Closes eventBus and datastore
      await db.open(id)
      expect(db.collections.size).to.equal(1)
      await db.close()
    })
  })

  describe('event emitter', () => {
    const assertEvents = (events: Update[], expected: Update[]) => {
      expect(events).to.have.length(expected.length)
      for (const i in events) {
        expect(events[i]).to.deep.include(expected[i])
      }
    }

    it('should listen to all db events', async () => {
      const actions = await runListenersComplexUseCase(['**'])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Create, id: 'id-i2' },
        { collection: 'Collection2', type: Op.Type.Create, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i2' },
        { collection: 'Collection2', type: Op.Type.Save, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i1' },
        { collection: 'Collection2', type: Op.Type.Delete, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i2' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to events on collection 1 only', async () => {
      const actions = await runListenersComplexUseCase(['Collection1.**'])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Create, id: 'id-i2' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i2' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i2' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to events on collection 2 only', async () => {
      const actions = await runListenersComplexUseCase(['Collection2.**'])
      const expected: Update[] = [
        { collection: 'Collection2', type: Op.Type.Create, id: 'id-j1' },
        { collection: 'Collection2', type: Op.Type.Save, id: 'id-j1' },
        { collection: 'Collection2', type: Op.Type.Delete, id: 'id-j1' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to any create events', async () => {
      const actions = await runListenersComplexUseCase([`**.${Op.Type.Create}`])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Create, id: 'id-i2' },
        { collection: 'Collection2', type: Op.Type.Create, id: 'id-j1' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to any save events', async () => {
      const actions = await runListenersComplexUseCase([`**.${Op.Type.Save}`])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i2' },
        { collection: 'Collection2', type: Op.Type.Save, id: 'id-j1' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to any delete events', async () => {
      const actions = await runListenersComplexUseCase([`**.${Op.Type.Delete}`])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i1' },
        { collection: 'Collection2', type: Op.Type.Delete, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i2' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to any collection1 events or delete events on collection2', async () => {
      const actions = await runListenersComplexUseCase([
        'Collection1.**',
        `Collection2.*.${Op.Type.Delete}`,
      ])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Create, id: 'id-i2' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i2' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i1' },
        { collection: 'Collection2', type: Op.Type.Delete, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i2' },
      ]
      assertEvents(actions, expected)
    })

    it('should not listen to any events for non-existant collections', async () => {
      const actions = await runListenersComplexUseCase(['Collection3.**'])
      const expected: Update[] = []
      assertEvents(actions, expected)
    })

    it('should listen to various complex mixed event types', async () => {
      const actions = await runListenersComplexUseCase([
        `Collection2.*.${Op.Type.Save}`,
        `Collection1.id-i2.${Op.Type.Save}`,
        `Collection1.id-i1.${Op.Type.Delete}`,
        `Collection2.id-j1.${Op.Type.Delete}`,
      ])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i2' },
        { collection: 'Collection2', type: Op.Type.Save, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i1' },
        { collection: 'Collection2', type: Op.Type.Delete, id: 'id-j1' },
      ]
      assertEvents(actions, expected)
    })
  })
})
