import {Client} from '../index'

const url = 'ws://localhost:8080'
const client = new Client()

describe('version', () => {
  it('should resolve', async () => {
    expect(await Client.version()).toBeDefined()
  })
})

describe.skip('connect', () => {
  it('should resolve', async () => {
    expect(await client.connect(url)).toBeUndefined()
  })
})
