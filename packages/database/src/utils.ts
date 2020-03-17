import {
  ThreadInfo,
  Variant,
  EventHeader,
  ThreadID,
  Multiaddr,
  ThreadRecord,
} from '@textile/threads-core'
import { Service } from '@textile/threads-service'
import { decodeBlock } from '@textile/threads-encoding'
import { randomBytes, keys } from 'libp2p-crypto'

const ed25519 = keys.supportedKeys.ed25519

export function decodeRecord<T = any>(rec: ThreadRecord, info: ThreadInfo) {
  if (!info.readKey || !rec.record || !info.replicatorKey) return // we don't have the right keys
  const event = rec.record.block
  const decodedHeader = decodeBlock<EventHeader>(event.header, info.readKey)
  const header = decodedHeader.decodeUnsafe()
  if (!header.key) return
  const decodedBody = decodeBlock<T>(event.body, header.key)
  const body = decodedBody.decode()
  return body
}

export async function createThread(
  service: Service,
  id: ThreadID = ThreadID.fromRandom(Variant.Raw, 32),
) {
  const replicatorKey = randomBytes(44)
  const readKey = randomBytes(44)
  // @todo: Let users/developers provide their own keys here.
  const logKey = await ed25519.generateKeyPair()
  const info = await service.createThread(id, {
    readKey,
    replicatorKey,
    logKey,
  })
  return info
}

export function threadAddr(hostAddr: Multiaddr, hostID: string, threadID: string) {
  const pa = new Multiaddr(`/p2p/${hostID}`)
  const ta = new Multiaddr(`/thread/${threadID}`)
  const full = hostAddr.encapsulate(pa.encapsulate(ta)) as any
  return full
}

export interface CacheOptions {
  duration?: number
}

export function Cache(params: CacheOptions = {}) {
  const defaultValues: Partial<CacheOptions> = {
    duration: 3000,
  }

  params = {
    ...defaultValues,
    ...params,
  }

  let originalFunc: Function
  let value: any
  let cacheUntil: Date | undefined

  let funcType: string

  const cacheValue = (val: any, now: Date) => {
    cacheUntil = params.duration ? new Date(now.getTime() + params.duration) : undefined
    value = val
  }

  return function(_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    originalFunc = descriptor.value

    descriptor.value = function() {
      const now = new Date()
      if (value && cacheUntil && cacheUntil > now) {
        switch (funcType) {
          case 'promise':
            return Promise.resolve(value)
          default:
            return value
        }
      }

      const result = originalFunc.apply(this)

      if (result instanceof Promise) {
        funcType = 'promise'
        return result.then(value => {
          cacheValue(value, now)
          return value
        })
      } else {
        funcType = 'value'
        cacheValue(result, now)
        return result
      }
    }
  }
}
