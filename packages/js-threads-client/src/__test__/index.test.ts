import {Client} from '../index'

const host = 'http://localhost:9091'
const client = new Client()

describe('version', () => {
  it('should resolve', async () => {
    expect(await Client.version()).toBeDefined()
  })
})

describe('setHost', () => {
  it('should resolve', async () => {
    expect(await client.setHost(host)).toBeDefined()
  })
})
