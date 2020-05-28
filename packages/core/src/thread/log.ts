import CID from 'cids'
import { PublicKey, PrivateKey } from '@textile/threads-crypto'
import PeerId from 'peer-id'
import { Multiaddr } from '@textile/multiaddr'

/**
 * LogID is a simple alias to PeerId for representing logs.
 */
export type LogID = PeerId
// export class LogID {
//   constructor() {}
//   static fromPrivKey(key: PrivateKey): LogID
//   static fromPubKey(key: PublicKey): LogID
//   static fromString(encoded: string) b58 default
//   static fromBytes(bytes: Uint8Array): LogID
//   toBytes(): Uint8Array
//   toString() // b58 default
// }

/**
 * LogInfo holds known info about a log.
 */
export interface LogInfo {
  /**
   * The logs ID.
   */
  id: LogID
  /**
   * The logs public key used to check signatures.
   */
  pubKey?: PublicKey
  /**
   * The logs private key, used to sign content when available.
   */
  privKey?: PrivateKey
  /**
   * The set of Multiaddrs associated with this log.
   */
  addrs?: Set<Multiaddr>
  /**
   * The set of heads for this log.
   */
  head?: CID
}
