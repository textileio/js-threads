import { MemoryDatastore } from 'interface-datastore'
import cbor from 'cbor-sync'
import { EncodingDatastore, Encoder } from './encoding'

const JsonEncoder: Encoder<any, Buffer> = {
  encode: (data: any) => Buffer.from(JSON.stringify(data)),
  decode: (stored: Buffer) => JSON.parse(stored.toString()),
}

const CborEncoder: Encoder<any, Buffer> = {
  encode: (data: any) => cbor.encode(data),
  decode: (stored: Buffer) => cbor.decode(stored),
}

const encoders: Encoder[] = [JsonEncoder, CborEncoder]

describe('ValuetransformDatastore', () => {
  encoders.forEach(encoder => {
    describe('interface-datastore', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('interface-datastore/src/tests')({
        setup() {
          return new EncodingDatastore(new MemoryDatastore(), encoder)
        },
        teardown() {
          return
        },
      })
    })
  })
})
