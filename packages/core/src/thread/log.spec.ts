import { expect } from 'chai'
import { keys } from '@textile/threads-crypto'

describe('LogID', () => {
  it('should do some stuff', async () => {
    const priv = await keys.generateKeyPair('Ed25519')
    expect(priv.public.bytes.length).to.be.greaterThan(42)
  })
})
