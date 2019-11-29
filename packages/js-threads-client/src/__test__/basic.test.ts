import { expect } from 'chai'
import { NodeHttpTransport } from '@improbable-eng/grpc-web-node-http-transport/lib'
import { Client } from '../index'

const host = 'http://localhost:9091'
let client: Client

describe('basic client', function() {
  before(() => {
    client = new Client(host, NodeHttpTransport())
  })

  describe('.version', function() {
    it('result should be defined', async () => {
      expect(Client.version()).to.not.be.undefined
    })
  })
})

describe('basic store', function() {
  before(() => {
    client = new Client(host, NodeHttpTransport())
  })
  describe('.newStore', function() {
    it('should resolve', async function() {
      const store = await client.newStore()
      expect(store.id).to.not.be.undefined
    })
  })
})
