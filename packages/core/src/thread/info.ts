import CID from 'cids'
import { ID } from './id'

// from multiaddr

type Code = number
type Size = number

interface Protocol {
  code: Code
  size: Size
  name: string
  resolvable: boolean
}

interface Protocols {
  (proto: string | number): Protocol

  readonly lengthPrefixedVarSize: number
  readonly V: number
  readonly table: Array<[number, number, string]>
  readonly names: { [index: string]: Protocol }
  readonly codes: { [index: number]: Protocol }

  object(code: Code, size: Size, name: string, resolvable: boolean): Protocol
}

interface Options {
  family: string
  host: string
  transport: string
  port: string
}

interface NodeAddress {
  family: string
  address: string
  port: string
}

export interface Multiaddr {
  readonly buffer: Buffer
  toString(): string
  toOptions(): Options
  inspect(): string
  protos(): Protocol[]
  protoCodes(): Code[]
  protoNames(): string[]
  tuples(): Array<[Code, Buffer]>
  stringTuples(): Array<[Code, string | number]>
  encapsulate(addr: string | Buffer | Multiaddr): Multiaddr
  decapsulate(addr: string | Buffer | Multiaddr): Multiaddr
  getPeerId(): string | undefined
  equals(other: Multiaddr): boolean
  nodeAddress(): NodeAddress
  isThinWaistAddress(addr: Multiaddr): boolean
  fromStupidString(str: string): never
}

// From libp2p-crypto

export type KeyTypes = 'ed25519' | 'rsa' | 'secp256k1'
// @todo: Export the specific key types as well
export interface PublicKey {
  verify(data: any, sig: any): Promise<any>
  marshal(): Buffer
  readonly bytes: Buffer
  equal(key: PublicKey): boolean
  hash(): Promise<Buffer>
}
export interface PrivateKey {
  sign(data: any): Promise<Buffer>
  readonly public: PublicKey
  marshal(): Buffer
  readonly bytes: Buffer
  equal(key: PublicKey): boolean
  hash(): Promise<Buffer>
  id(): Promise<string>
}

export interface Keypair {
  privateKey: PrivateKey
  publicKey: PublicKey
}

// Info holds a thread ID associated known logs.
export interface Info {
  id: ID
  logs: string[]
  // @todo: ask @sanderpick why this is a peer.ID in the go version
}

// LogInfo holds known info about a log.
export interface LogInfo {
  id: string
  pubKey: PublicKey
  privKey: PrivateKey
  followKey: Buffer // randomBytes
  readKey: Buffer // randomBytes
  addrs: Multiaddr[]
  heads: CID[]
}
