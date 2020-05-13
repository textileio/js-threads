import { expect } from 'chai'
import { Libp2pCryptoIdentity } from './identity'

describe('ThreadKey', () => {
  it('should be able to create a random ThreadKey', async () => {
    const id = await Libp2pCryptoIdentity.fromRandom()
    const str = id.toString()
    const back = await Libp2pCryptoIdentity.fromString(str)
    expect(id).to.deep.equal(back)
  })
})
