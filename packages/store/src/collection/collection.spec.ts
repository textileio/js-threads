/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from 'chai'
import { MemoryDatastore, Datastore, Key } from 'interface-datastore'
import { JSONSchema3or4 as JSONSchema } from 'to-json-schema'
import uuid from 'uuid'
import sinon from 'sinon'
import mingo from 'mingo'
import { collect } from 'streaming-iterables'
import { encode } from 'cbor-sync'
import { Collection, ReadBatch, WriteBatch, CollectionKey } from './collection'
import { FilterQuery } from './query'
import { ActionHandler } from '.'
import { EntityID, Action } from '..'

const personSchema: JSONSchema = {
  $id: 'https://example.com/person.schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Person',
  type: 'object',
  required: ['ID'],
  properties: {
    ID: {
      type: 'string',
      description: "The entity's id.",
    },
    name: {
      type: 'string',
      description: "The person's name.",
    },
    age: {
      description: 'Age in years which must be equal to or greater than zero.',
      type: 'integer',
      minimum: 0,
    },
  },
}

type Person = {
  ID: EntityID
  name: string
  age: number
}

const defaultPerson: Person = {
  ID: '',
  name: 'Lucas',
  age: 7,
}

// Simple action handler that just deletes or overwrites in one batch
const createHandler = (store: Datastore<Buffer>) => {
  const handler = async (actions: Action[]) => {
    const batch = store.batch()
    for (const action of actions) {
      const key = CollectionKey.child(new Key(action.collection)).child(new Key(action.entityID))
      switch (action.type) {
        case Action.Type.Delete:
          batch.delete(key)
          break
        case Action.Type.Create:
        case Action.Type.Save:
          batch.put(key, encode(action.current))
          break
      }
    }
    return batch.commit()
  }
  return handler
}

const setupCollection = (store: Datastore) => {
  return Collection.fromSchema<Person>('Person', personSchema, createHandler(store), store)
}

describe('Collection', () => {
  let store: Datastore
  let handler: ActionHandler
  beforeEach(() => {
    // Clear out the store before each run
    store = new MemoryDatastore()
    handler = createHandler(store)
  })
  describe('top-level instance', () => {
    it('should derive a validator from an schema', () => {
      const c = setupCollection(store)
      expect(c.validator(defaultPerson)).to.be.true
    })

    it('should derive a schema from an entity', () => {
      const c = Collection.fromObject('Person', defaultPerson, handler, store)
      expect(c.validator(defaultPerson)).to.be.true
    })

    it('should call its action handler for write operations', async () => {
      const spy = sinon.spy(handler)
      const c = Collection.fromSchema<Person>('Person', personSchema, spy, store)
      await c.create(defaultPerson, defaultPerson, defaultPerson)
      const another = await c.create(defaultPerson)
      await c.delete(another.ID)
      expect(spy.callCount).to.equal(3)
    })

    describe('creating entities', () => {
      it('should create a single entity (w/ type checking) at a time', async () => {
        const c = setupCollection(store)
        const person1 = await c.create(defaultPerson)
        const exists = await c.has(person1.ID)
        expect(exists).to.be.true
        const person2 = await c.create(defaultPerson)
        expect(await c.has(person2.ID)).to.be.true
      })

      it('should create multiple entities (variadic arguments w/ type checking) at once', async () => {
        const c = setupCollection(store)
        const persons = await c.create(defaultPerson, defaultPerson, defaultPerson)
        expect(await collect(c.datastore.query({}))).to.have.length(3)
        expect(await c.has(persons.pop()!.ID)).to.be.true
      })

      it('should create an entity with a predefined id', async () => {
        const c = setupCollection(store)
        const predefined = uuid()
        const person = await c.create({ ID: predefined, name: 'Hans', age: 12 })
        expect(person).to.have.ownProperty('ID', predefined)
      })

      it('should not overwrite an existing entity', async () => {
        const c = setupCollection(store)
        const predefined = uuid()
        try {
          await c.create({ ID: predefined, name: 'Hans', age: 12 })
          await c.create({ ID: predefined, name: 'Hans', age: 12 })
          throw new Error('should not create already existing instance')
        } catch (err) {
          expect(err.toString()).to.equal('Error: Existing Entity')
        }
      })
    })

    describe('creating transactions', () => {
      it('should create a readonly transaction', async () => {
        const c = setupCollection(store)
        const batch = await c.batch(false).start()
        expect(batch).to.be.instanceOf(ReadBatch)
        const has = await batch.has('blah')
        expect(has).to.be.false
        batch.discard()
      })

      it('should create a write transaction', async () => {
        const c = setupCollection(store)
        const batch = await c.batch(true).start()
        expect(batch).to.be.instanceOf(WriteBatch)
        const has = await batch.has('blah')
        expect(has).to.be.false
        batch.discard()
      })
    })

    describe('checking for entities', () => {
      it('should test for existing entity', async () => {
        const c = setupCollection(store)
        const person = await c.create(defaultPerson)
        expect(await c.has(person.ID)).to.be.true
        expect(await c.has('blah')).to.be.false
      })

      it('should test for multiple entities', async () => {
        const c = setupCollection(store)
        const persons = await c.create(defaultPerson, defaultPerson, defaultPerson)
        expect(await c.has(...persons.map(p => p.ID))).to.deep.equal([true, true, true])
        expect(await c.has('foo', 'bar', 'baz')).to.deep.equal([false, false, false])
      })
    })

    describe('returning entities', () => {
      it('should get existing entity', async () => {
        const c = setupCollection(store)
        const person = await c.create(defaultPerson)
        expect(await c.get(person.ID)).to.deep.equal(person)
        try {
          await c.get('blah')
          throw new Error('should throw on invalid id')
        } catch (err) {
          expect(err.toString()).to.equal('Error: Not Found')
        }
      })

      it('should get multiple entities', async () => {
        const c = setupCollection(store)
        const persons = await c.create(defaultPerson, defaultPerson, defaultPerson)
        expect(await c.get(...persons.map(p => p.ID))).to.deep.equal(persons)
        try {
          await c.get('foo', 'bar', 'baz')
          throw new Error('should throw on invalid id')
        } catch (err) {
          expect(err.toString()).to.equal('Error: Not Found')
        }
      })
    })

    describe('deleting for entities', () => {
      it('should delete existing entity', async () => {
        const c = setupCollection(store)
        const person = await c.create(defaultPerson)
        expect(await c.has(person.ID)).to.be.true
        await c.delete(person.ID)
        expect(await c.has(person.ID)).to.be.false
        try {
          await c.delete('blah')
          throw new Error('should throw on invalid id')
        } catch (err) {
          expect(err.toString()).to.equal('Error: Not Found')
        }
      })

      it('should delete multiple entities', async () => {
        const c = setupCollection(store)
        const persons = await c.create(defaultPerson, defaultPerson, defaultPerson)
        const ids = persons.map(p => p.ID)
        expect(await c.has(...ids)).to.deep.equal([true, true, true])
        await c.delete(...ids)
        expect(await c.has(...ids)).to.deep.equal([false, false, false])
        try {
          await c.delete('foo', 'bar', 'baz')
          throw new Error('should throw on invalid id')
        } catch (err) {
          expect(err.toString()).to.equal('Error: Not Found')
        }
      })
    })

    describe.skip('saving entities', () => {
      it('should save/update existing entity', async () => {
        const c = setupCollection(store)
        const person = await c.create(defaultPerson)
      })

      it('should save/update multiple entities', async () => {
        const c = setupCollection(store)
        const persons = await c.create(defaultPerson, defaultPerson, defaultPerson)
      })
      it('should not save/update non-existant entity', async () => {
        const c = setupCollection(store)
        const person = await c.create(defaultPerson)
      })
    })
  })

  describe('find/search', () => {
    it('should support simple queries', async () => {
      const c = setupCollection(store)
      const people: Person[] = [
        { ID: '', name: 'Lucas', age: 7 },
        { ID: '', name: 'Clyde', age: 99 },
        { ID: '', name: 'Duke', age: 2 },
      ]
      await c.create(...people)
      const query: FilterQuery<Person> = {
        // Find everyone over the age of 5
        age: { $gt: 5 },
      }
      const results = await collect(c.find(query))
      expect(results).to.have.length(2)
      const last = results.pop()
      expect(last).to.have.ownProperty('age')
      expect(last?.age).to.be.greaterThan(5)
    })

    it('should support complex queries', async () => {
      const c = setupCollection(store)
      const people: Person[] = [
        { ID: '', name: 'Lucas', age: 56 },
        { ID: '', name: 'Clyde', age: 55 },
        { ID: '', name: 'Mike', age: 52 },
        { ID: '', name: 'Micheal', age: 52 },
        { ID: '', name: 'Duke', age: 2 },
        { ID: '', name: 'Michelle', age: 2 },
        { ID: '', name: 'Michelangelo', age: 55 },
      ]
      await c.create(...people)
      const query: FilterQuery<Person> = {
        // Find people who are older than 5, and younger than 56, ...
        // and who's name starts with Mi or is Clyde, ...
        // but don't include Michael, he's a jerk...
        $and: [
          { age: { $gt: 5 } },
          { age: { $lt: 56 } },
          { $or: [{ name: { $regex: '^Mi' } }, { name: { $eq: 'Clyde' } }] },
          { name: { $not: { $eq: 'Micheal' } } },
        ],
      }
      const results = await collect(c.find(query))
      expect(results).to.have.length(3)
      const last = results.pop()
      expect(last).to.have.ownProperty('age')
      expect(last?.age).to.be.greaterThan(5)
      expect(last?.age).to.be.lessThan(56)
      // Use mingo directly, should also return 3 (sanity check)
      expect(mingo.find(await collect(c.find()), query).count()).to.equal(3)
    })
  })
  describe('read transaction', () => {
    it('should test for existing entity', async () => {
      const c = setupCollection(store)
      const person = await c.create(defaultPerson)
      const batch = c.batch() // Or single 'false' argument
      try {
        await batch.has(person.ID)
        throw new Error('should throw on on unstarted transaction')
      } catch (err) {
        expect(err.toString()).to.equal('Error: Not Started')
      }
      await batch.start()
      expect(await batch.has(person.ID)).to.be.true
      batch.discard()
    })

    it('should return existing entity', async () => {
      const c = setupCollection(store)
      const person = await c.create(defaultPerson)
      const batch = c.batch() // Or single 'false' argument
      try {
        await batch.get(person.ID)
        throw new Error('should throw on on unstarted transaction')
      } catch (err) {
        expect(err.toString()).to.equal('Error: Not Started')
      }
      await batch.start()
      expect(await batch.get(person.ID)).to.deep.equal(person)
      batch.discard()
    })

    it('should support multiple read transactions', async () => {
      const c = setupCollection(store)
      const person = await c.create(defaultPerson)
      const batch1 = c.batch() // Or single 'false' argument
      await batch1.start()
      const batch2 = await c.batch(false).start()
      expect(await batch2.has(person.ID)).to.be.true
      expect(await batch1.has(person.ID)).to.be.true
      batch1.discard()
      batch2.discard()
    })

    it('should support a timeout, and preclude any write transactions until done', async () => {
      const c = setupCollection(store)
      const read = c.batch() // Or single 'false' argument
      await read.start()
      const t1 = Date.now()
      const write = c.batch(true)
      try {
        // Start a deadlock...
        await write.start(2000) // Timeout after waiting 2 seconds
        throw new Error('should not be able to aquire this lock')
      } catch (err) {
        expect(err.toString()).to.equal('Error: acquire lock timeout')
        read.discard()
      }
      const t2 = Date.now()
      expect(t2 - t1 + 100).to.be.greaterThan(2000) // Adjust up to catch approx. timings
    }).timeout(3000)
  })

  describe('write transaction', () => {
    it('should test for uncommitted existing entity', async () => {
      // @see 'should delete uncommitted entities'
      const c = setupCollection(store)
      const batch = await c.batch(true).start()
      const person = await batch.create(defaultPerson)
      expect(await batch.has(person.ID)).to.be.true
      await batch.delete(person.ID)
      expect(await batch.has(person.ID)).to.be.false
      await batch.commit()
      expect(await c.has(person.ID)).to.be.false
    })

    it('should not handle actions from empty transaction', async () => {
      const spy = sinon.spy(createHandler(store))
      const c = Collection.fromSchema<Person>('Person', personSchema, spy, store)
      const batch = await c.batch(true).start()
      const person = await batch.create(defaultPerson)
      await batch.delete(person.ID)
      batch.commit()
      expect(spy.callCount).to.equal(0)
    })

    it('should return uncommitted entities', async () => {
      const c = setupCollection(store)
      const ID = uuid()
      expect(await c.has(ID)).to.be.false
      const batch = await c.batch(true).start()
      const person = await batch.create({ ...defaultPerson, ID })
      expect(await batch.get(ID)).to.deep.equal(person)
      batch.discard()
      expect(await c.has(ID)).to.be.false
    })

    it('should delete uncommitted entities', async () => {
      // @see 'should test for uncommitted existing entity'
      const c = setupCollection(store)
      const person = await c.create(defaultPerson)
      const batch = await c.batch(true).start()
      expect(await batch.has(person.ID)).to.be.true
      await batch.delete(person.ID)
      expect(await batch.has(person.ID)).to.be.false
      batch.discard()
      expect(await c.has(person.ID)).to.be.true
    })

    it.skip('should return save changes within a transaction', async () => {
      console.log('pass')
    })

    it('should not return entities with uncommitted deletes', async () => {
      const c = setupCollection(store)
      const person = await c.create(defaultPerson)
      const batch = await c.batch(true).start()
      expect(await batch.has(person.ID)).to.be.true
      await batch.delete(person.ID)
      try {
        await batch.get(person.ID)
        throw new Error('should have throw deleted entity error')
      } catch (err) {
        expect(err.toString()).to.equal('Error: Entity Deleted')
      }
      batch.discard()
      expect(await c.get(person.ID)).to.deep.equal(person)
    })

    it('should reflect changes on commit', async () => {
      const c = setupCollection(store)
      const people: Person[] = [
        { ID: '', name: 'Lucas', age: 56 },
        { ID: '', name: 'Clyde', age: 55 },
        { ID: '', name: 'Mike', age: 52 },
        { ID: '', name: 'Micheal', age: 52 },
        { ID: '', name: 'Duke', age: 2 },
        { ID: '', name: 'Michelle', age: 2 },
        { ID: '', name: 'Michelangelo', age: 55 },
      ]
      const created = await c.create(...people)
      const batch = await c.batch(true).start()
      const person = await batch.create(defaultPerson)
      await batch.delete(created[0].ID)
      await batch.delete(created[5].ID)
      await batch.commit()
      expect(await c.get(person.ID)).to.deep.equal(person)
      expect(await c.has(created[0].ID)).to.be.false
      expect(await c.has(created[5].ID)).to.be.false
    })

    it('should not overwrite an existing entity', async () => {
      const c = setupCollection(store)
      const predefined = uuid()
      const batch = await c.batch(true).start()
      try {
        await batch.create({ ID: predefined, name: 'Hans', age: 12 })
        await batch.create({ ID: predefined, name: 'Hans', age: 12 })
        throw new Error('should not create already existing instance')
      } catch (err) {
        batch.discard()
        expect(err.toString()).to.equal('Error: Existing Entity')
      }
    })

    it('should support a timeout, and preclude any read transactions until done', async () => {
      const c = setupCollection(store)
      const write = c.batch(true)
      await write.start()
      const t1 = Date.now()
      const read = c.batch(false)
      try {
        // Start a deadlock...
        await read.start(2000) // Timeout after waiting 2 seconds
        throw new Error('should not be able to aquire this lock')
      } catch (err) {
        expect(err.toString()).to.equal('Error: acquire lock timeout')
        write.discard()
      }
      const t2 = Date.now()
      expect(t2 - t1 + 100).to.be.greaterThan(2000) // Adjust up to catch approx. timings
    }).timeout(3000)
  })
})
