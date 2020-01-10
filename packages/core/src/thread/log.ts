import CID from 'cids'
import Multiaddr from 'multiaddr'
import { PublicKey, PrivateKey } from '../external'
import { LogID, ThreadID } from './id'

// LogInfo holds known info about a log.
export interface LogInfo {
  id: LogID
  pubKey: PublicKey
  privKey?: PrivateKey
  addrs?: Set<Multiaddr>
  heads?: Set<CID>
}
