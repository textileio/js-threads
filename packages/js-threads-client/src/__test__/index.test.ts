/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/first */
// Some hackery to get WebSocket in the global namespace on nodejs
// @todo: Find a nicer way to do this...
;(global as any).WebSocket = require('isomorphic-ws')

import { expect } from 'chai'
import multibase from 'multibase'
import { encode } from 'varint'
import { randomBytes } from 'libp2p-crypto'
import { ReadTransaction } from 'src/ReadTransaction'
import { WriteTransaction } from 'src/WriteTransaction'
import { Client } from '../index'
import { JSONQuery, JSONOperation } from '../models'
import { Where } from '../query'

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

describe('Client', function() {
  const bytes = Buffer.concat([Buffer.from(encode(0x01)), Buffer.from(encode(0x55)), randomBytes(32)])
  const dbID = multibase.encode('base32', bytes).toString()
  let dbKey: string
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
      expect(invites).to.not.be.empty
    })
  })

  describe.skip('.newDBFromAddr', () => {
    it('response should be defined and be an empty object', async () => {
      const start = await client.newDBFromAddr(dbID, dbKey, [{ name: 'Person', schema: personSchema }])
      expect(start).to.be.undefined
    })
  })
  describe('.create', () => {
    it('response should contain a JSON parsable instancesList', async () => {
      const create = await client.create<Person>(dbID, 'Person', [createPerson()])
      expect(create).to.not.be.undefined
      expect(create).to.haveOwnProperty('instancesList')
      const entities = create.instancesList
      expect(entities).to.have.nested.property('[0].firstName', 'Adam')
      expect(entities).to.have.nested.property('[0].lastName', 'Doe')
      expect(entities).to.have.nested.property('[0].age', 21)
      expect(entities).to.have.nested.property('[0].ID')
    })
  })
  describe('.save', () => {
    it('response should be defined and be an empty object', async () => {
      const create = await client.create<Person>(dbID, 'Person', [createPerson()])
      const entities = create.instancesList
      const person = entities.pop()
      person!.age = 30
      const save = await client.save(dbID, 'Person', [person])
      expect(save).to.be.undefined
    })
  })
  describe('.delete', () => {
    it('response should be defined and be an empty object', async () => {
      const create = await client.create<Person>(dbID, 'Person', [createPerson()])
      const entities = create.instancesList
      const person = entities.pop()
      const deleted = await client.delete(dbID, 'Person', [person!.ID])
      expect(deleted).to.be.undefined
    })
  })
  describe('.has', () => {
    it('response be an object with property "exists" equal to true', async () => {
      const create = await client.create(dbID, 'Person', [createPerson()])
      const entities = create.instancesList
      // Here we 'test' a different approach where we didn't use generics above to create the instance...
      const person: Person = entities.pop()
      const has = await client.has(dbID, 'Person', [person.ID])
      expect(has).to.be.true
    })
  })
  describe('.find', () => {
    it('', async () => {
      const frank = createPerson()
      frank.firstName = 'Frank'
      const create = await client.create<Person>(dbID, 'Person', [frank])
      const entities = create.instancesList
      const person = entities.pop()!

      const q: JSONQuery = {
        ands: [
          {
            fieldPath: 'firstName',
            operation: JSONOperation.Eq,
            value: { string: person.firstName },
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
    })
  })
  describe('.findById', () => {
    it('response should contain a JSON parsable instance property', async () => {
      const create = await client.create(dbID, 'Person', [createPerson()])
      const entities = create.instancesList
      const person = entities.pop()!
      const find = await client.findByID<Person>(dbID, 'Person', person.ID)
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
    let existingPerson: Person
    let transaction: ReadTransaction | undefined
    before(async () => {
      const create = await client.create<Person>(dbID, 'Person', [createPerson()])
      const entities = create.instancesList
      existingPerson = entities.pop()!
      transaction = client.readTransaction(dbID, 'Person')
    })
    it('should start a transaction', async () => {
      expect(transaction).to.not.be.undefined
      await transaction!.start()
    })
    it('should able to check for an existing instance', async () => {
      const has = await transaction!.has([existingPerson.ID])
      expect(has).to.be.true
    })
    it('should be able to find an existing instance', async () => {
      const find = await transaction!.findByID<Person>(existingPerson.ID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('instance')
      const instance = find!.instance
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property('firstName', 'Adam')
      expect(instance).to.have.property('lastName', 'Doe')
      expect(instance).to.have.property('age', 21)
      expect(instance).to.have.property('ID')
      expect(instance).to.deep.equal(existingPerson)
    })
    it('should be able to close/end an transaction', async () => {
      await transaction!.end()
    })
  })
  describe('.writeTransaction', () => {
    let existingPerson: Person
    let transaction: WriteTransaction | undefined
    before(async () => {
      const create = await client.create(dbID, 'Person', [createPerson()])
      const entities = create.instancesList
      existingPerson = entities.pop()
      transaction = client.writeTransaction(dbID, 'Person')
    })
    it('should start a transaction', async () => {
      expect(transaction).to.not.be.undefined
      await transaction!.start()
    })
    it('should be able to create an instance', async () => {
      const newPerson = createPerson()
      const created = await transaction!.create<Person>([newPerson])
      expect(created).to.not.be.undefined
      expect(created).to.haveOwnProperty('instancesList')
      const entities = created!.instancesList
      expect(entities).to.have.nested.property('[0].firstName', 'Adam')
      expect(entities).to.have.nested.property('[0].lastName', 'Doe')
      expect(entities).to.have.nested.property('[0].age', 21)
      expect(entities).to.have.nested.property('[0].ID')
    })
    it('should able to check for an existing instance', async () => {
      const has = await transaction!.has([existingPerson.ID])
      expect(has).to.be.true
    })
    it('should be able to find an existing instance', async () => {
      const find = await transaction!.findByID<Person>(existingPerson.ID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('instance')
      const instance = find!.instance
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property('firstName', 'Adam')
      expect(instance).to.have.property('lastName', 'Doe')
      expect(instance).to.have.property('age', 21)
      expect(instance).to.have.property('ID')
      expect(instance).to.deep.equal(existingPerson)
    })
    it('should be able to save an existing instance', async () => {
      existingPerson.age = 99
      const saved = await transaction!.save([existingPerson])
      expect(saved).to.be.undefined
      const deleted = await transaction!.delete([existingPerson.ID])
      expect(deleted).to.be.undefined
    })
    it('should be able to close/end an transaction', async () => {
      await transaction!.end()
    })
  })
  describe('.listen', () => {
    let existingPerson: Person
    const events: number[] = []
    before(async () => {
      const create = await client.create<Person>(dbID, 'Person', [createPerson()])
      const entities = create.instancesList
      existingPerson = entities.pop()!
    })
    it('should stream responses.', done => {
      const close = client.listen<Person>(dbID, 'Person', existingPerson.ID, (reply, err) => {
        const instance = reply?.instance
        expect(instance).to.not.be.undefined
        expect(instance).to.have.property('age')
        expect(instance?.age).to.be.greaterThan(21)
        events.push(instance?.age || 0)
        if (events.length == 2) {
          close()
          done()
        }
        if (err) {
          throw err
        }
      })
      existingPerson.age = 30
      client.save(dbID, 'Person', [existingPerson]).then(() => {
        existingPerson.age = 40
        return client.save(dbID, 'Person', [existingPerson])
      })
    }).timeout(25000) // Make sure our test doesn't timeout
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
      const q = new Where('age')
        .ge(60)
        .and('age')
        .lt(66)
        .or(new Where('age').eq(67))
      const find = await client.find<Person>(dbID, 'Person', q)
      expect(find).to.not.be.undefined
      const found = find.instancesList
      expect(found).to.have.length(7)
    })
  })
})
