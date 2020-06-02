import CID from 'cids'
import { PublicKey, PrivateKey } from '@textile/threads-crypto'
import { Multiaddr } from '@textile/multiaddr'
import PeerId from 'peer-id'

export type LogID = PeerId
/**
 * LogID represents a simplified PeerID used for tracking thread logs.
 * It is a minimal implementation of PeerID useful mostly for marshaling and unmarshaling.
 */
// export class LogID {
//   constructor(readonly private?: PrivateKey, readonly public?: PublicKey) {}
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
