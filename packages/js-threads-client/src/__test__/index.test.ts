import { expect } from 'chai'
import { NodeHttpTransport } from '@improbable-eng/grpc-web-node-http-transport'
import { Client } from '../index'

const host = 'http://localhost:9091'
const client = new Client(NodeHttpTransport())

const personSchema = `{
  "$id": "https://example.com/person.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Person",
  "type": "object",
  "properties": {
    "firstName": {
      "type": "string",
      "description": "The person's first name."
    },
    "lastName": {
      "type": "string",
      "description": "The person's last name."
    },
    "age": {
      "description": "Age in years which must be equal to or greater than zero.",
      "type": "integer",
      "minimum": 0
    }
  }
}
`

describe.skip('newStore', () => {
  it('should resolve', async () => {
    const store = await client.newStore()
    expect(store.id).to.not.be.undefined

    describe('registerSchema', () => {
      it('should resolve', async () => {
        expect(await client.registerSchema(store.id, 'Person', personSchema)).to.not.be.undefined
      })
    })
  })
})
