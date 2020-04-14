/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/first */
// Some hackery to get WebSocket in the global namespace on nodejs
// @todo: Find a nicer way to do this...
;(global as any).WebSocket = require('isomorphic-ws')

import { expect } from 'chai'
import { Client, ThreadID } from './index'
import { QueryJSON, ComparisonJSON, Where, ReadTransaction, WriteTransaction } from './models'

const client = new Client()

const personSchema = {
  $id: 'https://example.com/person.schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Person',
  type: 'object',
  required: ['ID'],
  properties: {
    ID: {
      type: 'string',
      description: "The instance's id.",
    },
    firstName: {
      type: 'string',
      description: "The person's first name.",
    },
    lastName: {
      type: 'string',
      description: "The person's last name.",
    },
    age: {
      description: 'Age in years which must be equal to or greater than zero.',
      type: 'integer',
      minimum: 0,
    },
  },
}

interface Person {
  ID: string
  firstName: string
  lastName: string
  age: number
}

const createPerson = (): Person => {
  return {
    ID: '',
    firstName: 'Adam',
    lastName: 'Doe',
    age: 21,
  }
}

describe('Client', function () {
  const threadId = ThreadID.fromRandom()
  const dbID = threadId.toBytes()
  let dbKey: string
  let dbAddr: string
  describe('.newDB', () => {
    it('response should succeed', async () => {
      await client.newDB(dbID)
    })
  })
  describe('.newCollection', () => {
    it('response should be defined and be an empty object', async () => {
      const register = await client.newCollection(dbID, 'Person', personSchema)
      expect(register).to.be.undefined
    })
  })
  describe('.getDBInfo', () => {
    it('response should be defined and be an array of strings', async () => {
      const invites = await client.getDBInfo(dbID)
      expect(invites).to.not.be.undefined
      expect(invites[0].address).to.not.be.undefined
      expect(invites[0].key).to.not.be.undefined
      dbKey = invites[0].key
      dbAddr = invites[0].address
      expect(invites).to.not.be.empty
    })
  })

  describe('.newDBFromAddr', () => {
    it('response should be defined and be an empty object', async () => {
      try {
        await client.newDBFromAddr((dbAddr as unknown) as string, dbKey, [])
      } catch (err) {
        // Expect this db to already exist on this peer
        expect(err.toString().endsWith('already exists')).to.be.true
      }
    })
  })
  describe('.create', () => {
    it('response should contain a JSON parsable instancesList', async () => {
      const entities = await client.create<Person>(dbID, 'Person', [createPerson()])
      expect(entities.length).to.equal(1)
    })
  })
  describe('.save', () => {
    it('response should be defined and be an empty object', async () => {
      const person = createPerson()
      const entities = await client.create<Person>(dbID, 'Person', [person])
      expect(entities.length).to.equal(1)
      person.ID = entities[0]
      person!.age = 30
      const save = await client.save(dbID, 'Person', [person])
      expect(save).to.be.undefined
    })
  })
  describe('.delete', () => {
    it('response should be defined and be an empty object', async () => {
      const entities = await client.create<Person>(dbID, 'Person', [createPerson()])
      expect(entities.length).to.equal(1)
      const personID = entities[0]
      const deleted = await client.delete(dbID, 'Person', [personID])
      expect(deleted).to.be.undefined
    })
  })
  describe('.has', () => {
    it('response be an object with property "exists" equal to true', async () => {
      const entities = await client.create(dbID, 'Person', [createPerson()])
      // Here we 'test' a different approach where we didn't use generics above to create the instance...
      expect(entities.length).to.equal(1)
      const personID = entities[0]
      const has = await client.has(dbID, 'Person', [personID])
      expect(has).to.be.true
    })
  })
  describe('.find', () => {
    it('response should contain the same entity based on query', async () => {
      const frank = createPerson()
      frank.firstName = 'Frank'
      const entities = await client.create<Person>(dbID, 'Person', [frank])
      expect(entities.length).to.equal(1)
      const personID = entities[0]

      const q: QueryJSON = {
        ands: [
          {
            fieldPath: 'firstName',
            operation: ComparisonJSON.Eq,
            value: { string: frank.firstName },
          },
        ],
      }
      const find = await client.find<Person>(dbID, 'Person', q)
      expect(find).to.not.be.undefined
      const found = find.instancesList
      expect(found).to.have.length(1)
      const foundPerson = found.pop()!
      expect(foundPerson).to.not.be.undefined
      expect(foundPerson).to.have.property('firstName', 'Frank')
      expect(foundPerson).to.have.property('lastName', 'Doe')
      expect(foundPerson).to.have.property('age', 21)
      expect(foundPerson).to.have.property('ID')
      expect(foundPerson['ID']).to.equal(personID)
    })
  })
  describe('.findById', () => {
    it('response should contain a JSON parsable instance property', async () => {
      const entities = await client.create(dbID, 'Person', [createPerson()])
      const personID = entities.pop()!
      const find = await client.findByID<Person>(dbID, 'Person', personID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('instance')
      const instance = find.instance
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property('firstName', 'Adam')
      expect(instance).to.have.property('lastName', 'Doe')
      expect(instance).to.have.property('age', 21)
      expect(instance).to.have.property('ID')
    })
  })
  describe('.readTransaction', () => {
    let existingPersonID: string
    let transaction: ReadTransaction | undefined
    before(async () => {
      const entities = await client.create<Person>(dbID, 'Person', [createPerson()])
      existingPersonID = entities.pop()!
      transaction = client.readTransaction(dbID, 'Person')
    })
    it('should start a transaction', async () => {
      expect(transaction).to.not.be.undefined
      await transaction!.start()
    })
    it('should able to check for an existing instance', async () => {
      const has = await transaction!.has([existingPersonID])
      expect(has).to.be.true
    })
    it('should be able to find an existing instance', async () => {
      const find = await transaction!.findByID<Person>(existingPersonID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('instance')
      const instance = find!.instance
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property('firstName', 'Adam')
      expect(instance).to.have.property('lastName', 'Doe')
      expect(instance).to.have.property('age', 21)
      expect(instance).to.have.property('ID')
      expect(instance['ID']).to.deep.equal(existingPersonID)
    })
    it('should be able to close/end an transaction', async () => {
      await transaction!.end()
    })
  })
  describe('.writeTransaction', () => {
    const person = createPerson()
    let existingPersonID: string
    let transaction: WriteTransaction | undefined
    before(async () => {
      const entities = await client.create(dbID, 'Person', [person])
      existingPersonID = entities.length ? entities[0] : ''
      person['ID'] = existingPersonID
      transaction = client.writeTransaction(dbID, 'Person')
    })
    it('should start a transaction', async () => {
      expect(transaction).to.not.be.undefined
      await transaction!.start()
    })
    it('should be able to create an instance', async () => {
      const newPerson = createPerson()
      const entities = await transaction!.create<Person>([newPerson])
      expect(entities).to.not.be.undefined
      expect(entities!.length).to.equal(1)
    })
    it('should able to check for an existing instance', async () => {
      const has = await transaction!.has([existingPersonID])
      expect(has).to.be.true
    })
    it('should be able to find an existing instance', async () => {
      const find = await transaction!.findByID<Person>(existingPersonID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('instance')
      const instance = find!.instance
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property('firstName', 'Adam')
      expect(instance).to.have.property('lastName', 'Doe')
      expect(instance).to.have.property('age', 21)
      expect(instance).to.have.property('ID')
      expect(instance['ID']).to.deep.equal(existingPersonID)
    })
    it('should be able to save an existing instance', async () => {
      person.age = 99
      const saved = await transaction!.save([person])
      expect(saved).to.be.undefined
      const deleted = await transaction!.delete([person.ID])
      expect(deleted).to.be.undefined
    })
    it('should be able to close/end an transaction', async () => {
      await transaction!.end()
    })
  })
  describe('.listen', () => {
    const listener: { events: number; close?: () => void } = { events: 0 }
    const person = createPerson()
    let existingPersonID: string
    before(async () => {
      const entities = await client.create<Person>(dbID, 'Person', [person])
      existingPersonID = entities.length ? entities[0] : ''
      person['ID'] = existingPersonID
    })
    it('should stream responses.', (done) => {
      const callback = (reply: any, err?: Error) => {
        if (err) {
          throw err
        }
        const instance = reply?.instance
        expect(instance).to.not.be.undefined
        expect(instance).to.have.property('age')
        expect(instance?.age).to.be.greaterThan(21)
        listener.events += 1
        if (listener.events > 1 && listener.close) {
          listener.close()
        }
        if (listener.events == 2) {
          done()
        }
      }
      listener.close = client.listen<Person>(
        dbID,
        [
          {
            instanceID: person.ID,
          },
        ],
        callback,
      )
      person.age = 30
      client.save(dbID, 'Person', [person])
      person.age = 40
      client.save(dbID, 'Person', [person])
    }).timeout(15000) // Make sure our test doesn't timeout
  })
  describe('Query', () => {
    before(async () => {
      const people = [...Array(8)].map((_, i) => {
        const person = createPerson()
        person.age = 60 + i
        return person
      })
      await client.create<Person>(dbID, 'Person', people)
    })
    it('Should return a full list of entities matching the given query', async () => {
      const q = new Where('age').ge(60).and('age').lt(66).or(new Where('age').eq(67))
      const find = await client.find<Person>(dbID, 'Person', q)
      expect(find).to.not.be.undefined
      const found = find.instancesList
      expect(found).to.have.length(7)
    })
  })
})
