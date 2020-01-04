import CID from 'cids'
import { PublicKey, PrivateKey, Multiaddr } from '../external'
import { ThreadID, LogID } from './id'

// Info holds a thread ID associated known logs.
export interface ThreadInfo {
  id: ThreadID
  logs?: Set<LogID>
  replicatorKey?: Buffer
  readKey?: Buffer
}

// LogInfo holds known info about a log.
export interface LogInfo {
  id: LogID
  pubKey: PublicKey
  privKey?: PrivateKey
  addrs?: Set<Multiaddr>
  heads?: Set<CID>
}
