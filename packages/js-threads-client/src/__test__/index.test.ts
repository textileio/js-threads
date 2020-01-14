/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/first */
// Some hackery to get WebSocket in the global namespace on nodejs
// @todo: Find a nicer way to do this...
;(global as any).WebSocket = require('isomorphic-ws')

import { expect } from 'chai'
import { NewStoreReply } from '@textile/threads-client-grpc/api_pb'
import { WriteTransaction } from 'src/WriteTransaction'
import { Client } from '../index'
import { JSONQuery, JSONOperation } from '../models'
import { Where } from '../query'
import { ReadTransaction } from 'src/ReadTransaction'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const client = new Client('http://localhost:7006')

const personSchema = {
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
  let store: NewStoreReply.AsObject
  describe('.newStore', () => {
    it('response should be defined and have an id', async () => {
      store = await client.newStore()
      expect(store).to.not.be.undefined
      expect(store).to.haveOwnProperty('id')
      expect(store.id).to.not.be.undefined
    })
  })
  describe('.registerSchema', () => {
    it('response should be defined and be an empty object', async () => {
      const register = await client.registerSchema(store.id, 'Person', personSchema)
      expect(register).to.be.undefined
    })
  })
  describe('.start', () => {
    it('response should be defined and be an empty object', async () => {
      const start = await client.start(store.id)
      expect(start).to.be.undefined
    })
  })
  describe('.getStoreLink', () => {
    it('response should be defined and be an array of strings', async () => {
      const invites = await client.getStoreLink(store.id)
      expect(invites).to.not.be.undefined
      expect(invites[0].address).to.not.be.undefined
      expect(invites[0].followKey).to.not.be.undefined
      expect(invites[0].readKey).to.not.be.undefined
      // @todo: Combine this with startFromAddress for a better 'round-trip' test
      expect(invites).to.not.be.empty
    })
  })

  describe.skip('.startFromAddress', () => {
    it('response should be defined and be an empty object', async () => {
      // @todo: Combine this with getStoreLink for a better 'round-trip' test
      const start = await client.startFromAddress(store.id, '', '', '')
      expect(start).to.be.undefined
    })
  })
  describe('.modelCreate', () => {
    it('response should contain a JSON parsable entitiesList', async () => {
      const create = await client.modelCreate<Person>(store.id, 'Person', [createPerson()])
      expect(create).to.not.be.undefined
      expect(create).to.haveOwnProperty('entitiesList')
      const entities = create.entitiesList
      expect(entities).to.have.nested.property('[0].firstName', 'Adam')
      expect(entities).to.have.nested.property('[0].lastName', 'Doe')
      expect(entities).to.have.nested.property('[0].age', 21)
      expect(entities).to.have.nested.property('[0].ID')
    })
  })
  describe('.modelSave', () => {
    it('response should be defined and be an empty object', async () => {
      const create = await client.modelCreate<Person>(store.id, 'Person', [createPerson()])
      const entities = create.entitiesList
      const person = entities.pop()
      person!.age = 30
      const save = await client.modelSave(store.id, 'Person', [person])
      expect(save).to.be.undefined
    })
  })
  describe('.modelDelete', () => {
    it('response should be defined and be an empty object', async () => {
      const create = await client.modelCreate<Person>(store.id, 'Person', [createPerson()])
      const entities = create.entitiesList
      const person = entities.pop()
      const deleted = await client.modelDelete(store.id, 'Person', [person!.ID])
      expect(deleted).to.be.undefined
    })
  })
  describe('.modelHas', () => {
    it('response be an object with property "exists" equal to true', async () => {
      const create = await client.modelCreate(store.id, 'Person', [createPerson()])
      const entities = create.entitiesList
      // Here we 'test' a different approach where we didn't use generics above to create the entity...
      const person: Person = entities.pop()
      const has = await client.modelHas(store.id, 'Person', [person.ID])
      expect(has).to.be.true
    })
  })
  describe('.modelFind', () => {
    it('', async () => {
      const frank = createPerson()
      frank.firstName = 'Frank'
      const create = await client.modelCreate<Person>(store.id, 'Person', [frank])
      const entities = create.entitiesList
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
      const find = await client.modelFind<Person>(store.id, 'Person', q)
      expect(find).to.not.be.undefined
      const found = find.entitiesList
      expect(found).to.have.length(1)
      const foundPerson = found.pop()!
      expect(foundPerson).to.not.be.undefined
      expect(foundPerson).to.have.property('firstName', 'Frank')
      expect(foundPerson).to.have.property('lastName', 'Doe')
      expect(foundPerson).to.have.property('age', 21)
      expect(foundPerson).to.have.property('ID')
    })
  })
  describe('.modelFindById', () => {
    it('response should contain a JSON parsable entity property', async () => {
      const create = await client.modelCreate(store.id, 'Person', [createPerson()])
      const entities = create.entitiesList
      const person = entities.pop()!
      const find = await client.modelFindByID<Person>(store.id, 'Person', person.ID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('entity')
      const entity = find.entity
      expect(entity).to.not.be.undefined
      expect(entity).to.have.property('firstName', 'Adam')
      expect(entity).to.have.property('lastName', 'Doe')
      expect(entity).to.have.property('age', 21)
      expect(entity).to.have.property('ID')
    })
  })
  describe('.readTransaction', () => {
    let existingPerson: Person
    let transaction: ReadTransaction | undefined
    before(async () => {
      const create = await client.modelCreate<Person>(store.id, 'Person', [createPerson()])
      const entities = create.entitiesList
      existingPerson = entities.pop()!
      transaction = client.readTransaction(store.id, 'Person')
    })
    it('should start a transaction', async () => {
      expect(transaction).to.not.be.undefined
      await transaction!.start()
    })
    it('should able to check for an existing entity', async () => {
      const has = await transaction!.has([existingPerson.ID])
      expect(has).to.be.true
    })
    it('should be able to find an existing entity', async () => {
      const find = await transaction!.modelFindByID<Person>(existingPerson.ID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('entity')
      const entity = find!.entity
      expect(entity).to.not.be.undefined
      expect(entity).to.have.property('firstName', 'Adam')
      expect(entity).to.have.property('lastName', 'Doe')
      expect(entity).to.have.property('age', 21)
      expect(entity).to.have.property('ID')
      expect(entity).to.deep.equal(existingPerson)
    })
    it('should be able to close/end an transaction', async () => {
      await transaction!.end()
    })
  })
  describe('.writeTransaction', () => {
    let existingPerson: Person
    let transaction: WriteTransaction | undefined
    before(async () => {
      const create = await client.modelCreate(store.id, 'Person', [createPerson()])
      const entities = create.entitiesList
      existingPerson = entities.pop()
      transaction = client.writeTransaction(store.id, 'Person')
    })
    it('should start a transaction', async () => {
      expect(transaction).to.not.be.undefined
      await transaction!.start()
    })
    it('should be able to create an entity', async () => {
      const newPerson = createPerson()
      const created = await transaction!.modelCreate<Person>([newPerson])
      expect(created).to.not.be.undefined
      expect(created).to.haveOwnProperty('entitiesList')
      const entities = created!.entitiesList
      expect(entities).to.have.nested.property('[0].firstName', 'Adam')
      expect(entities).to.have.nested.property('[0].lastName', 'Doe')
      expect(entities).to.have.nested.property('[0].age', 21)
      expect(entities).to.have.nested.property('[0].ID')
    })
    it('should able to check for an existing entity', async () => {
      const has = await transaction!.has([existingPerson.ID])
      expect(has).to.be.true
    })
    it('should be able to find an existing entity', async () => {
      const find = await transaction!.modelFindByID<Person>(existingPerson.ID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('entity')
      const entity = find!.entity
      expect(entity).to.not.be.undefined
      expect(entity).to.have.property('firstName', 'Adam')
      expect(entity).to.have.property('lastName', 'Doe')
      expect(entity).to.have.property('age', 21)
      expect(entity).to.have.property('ID')
      expect(entity).to.deep.equal(existingPerson)
    })
    it('should be able to save an existing entity', async () => {
      existingPerson.age = 99
      const saved = await transaction!.modelSave([existingPerson])
      expect(saved).to.be.undefined
      const deleted = await transaction!.modelDelete([existingPerson.ID])
      expect(deleted).to.be.undefined
    })
    it('should be able to close/end an transaction', async () => {
      await transaction!.end()
    })
  })
  describe('.listen', () => {
    it('should stream responses.', async () => {
      const create = await client.modelCreate<Person>(store.id, 'Person', [createPerson()])
      const entities = create.entitiesList
      const existingPerson = entities.pop()!
      const events: number[] = []
      const closer = client.listen<Person>(store.id, 'Person', existingPerson.ID, reply => {
        const entity = reply.entity
        expect(entity).to.not.be.undefined
        expect(entity).to.have.property('age')
        expect(entity.age).to.be.greaterThan(21)
        events.push(entity.age)
      })
      existingPerson.age = 30
      await client.modelSave(store.id, 'Person', [existingPerson])
      existingPerson.age = 40
      await client.modelSave(store.id, 'Person', [existingPerson])
      closer()
      while (events.length < 2) {
        await sleep(250) // simply wait for our events to fire
      }
      expect(events.length).to.equal(2)
    }).timeout(25000) // Make sure our test doesn't timeout
  })
  describe('Query', () => {
    before(async () => {
      const people = [...Array(8)].map((_, i) => {
        const person = createPerson()
        person.age = 60 + i
        return person
      })
      await client.modelCreate<Person>(store.id, 'Person', people)
    })
    it('Should return a full list of entities matching the given query', async () => {
      const q = new Where('age')
        .ge(60)
        .and('age')
        .lt(66)
        .or(new Where('age').eq(67))
      const find = await client.modelFind<Person>(store.id, 'Person', q)
      expect(find).to.not.be.undefined
      const found = find.entitiesList
      expect(found).to.have.length(7)
    })
  })
})
