/* eslint-disable @typescript-eslint/no-var-requires */
import { grpc } from '@improbable-eng/grpc-web'
import Multiaddr from 'multiaddr'
import {
  GetLogsRequest,
  GetLogsReply,
  Log as ProtoLog,
  PushLogRequest,
  GetRecordsReply,
  GetRecordsRequest,
  PushRecordRequest,
  PushRecordReply,
  Log,
} from '@textile/threads-service-grpc/service_pb'
// import { RecordEncoder } from '@textile/threads-encoding'
import { Service } from '@textile/threads-service-grpc/service_pb_service'
import CID from 'cids'
import { RecordEncoder } from '@textile/threads-encoding'
import { ThreadID, LogID, LogInfo, Network, LogEntry, LinkRecord, PrivateKey } from '@textile/threads-core'

const { keys } = require('libp2p-crypto')
const PeerId = require('peer-id')

const protoToLog = (protoLog: ProtoLog.AsObject) => {
  const id = Buffer.from(protoLog.id as string, 'base64')
  const pid = PeerId.createFromBytes(id)
  const log: LogInfo = {
    id: pid.toString(),
    addrs: new Set(protoLog.addrsList.map(addr => Multiaddr(Buffer.from(addr as string, 'base64')))),
    heads: new Set(protoLog.headsList.map(head => new CID(Buffer.from(head as string, 'base64')))),
    pubKey: keys.unmarshalPublicKey(Buffer.from(protoLog.pubkey as string, 'base64')),
    privKey: undefined, // @todo: Is this always the case?
  }
  return log
}

/**
 * Client is a web-gRPC wrapper client for communicating with a webgRPC-enabled Textile server.
 * This client library can be used to interact with a local or remote Textile gRPC-service.
 */
export class Client implements Network {
  /**
   * Client creates a new gRPC client instance.
   * @param host The local/remote host url. Defaults to 'localhost:7006'.
   * @param defaultTransport The default transport to use when making webgRPC calls. Defaults to WebSockets.
   */
  constructor(
    private hostID: any,
    private readonly host: string = 'http://localhost:5006',
    defaultTransport?: grpc.TransportFactory,
  ) {
    const transport = defaultTransport || grpc.WebsocketTransport()
    grpc.setDefaultTransport(transport)
  }
  // GetLogs from a peer.
  async getLogs(id: ThreadID, replicatorKey: Buffer) {
    const req = new GetLogsRequest()
    req.setFollowkey(replicatorKey)
    req.setThreadid(id.bytes())
    const header = new GetLogsRequest.Header()
    header.setFrom(this.hostID.toBytes())
    req.setHeader(header)
    const res = (await this.unary(Service.GetLogs, req)) as GetLogsReply.AsObject
    const logs = res.logsList.map(protoToLog)
    return logs
  }
  // PushLog to a peer.
  async pushLog(id: ThreadID, log: LogInfo, replicatorKey: Buffer, readKey?: Buffer) {
    const req = new PushLogRequest()
    req.setFollowkey(replicatorKey)
    readKey && req.setReadkey(readKey)
    req.setThreadid(id.bytes())
    const header = new PushLogRequest.Header()
    header.setFrom(this.hostID.toBytes())
    req.setHeader(header)
    const protoLog = new ProtoLog()
    protoLog.setAddrsList([...(log.addrs || [])].map(item => item.buffer))
    protoLog.setHeadsList([...(log.heads || [])].map(item => item.buffer))
    protoLog.setId(this.hostID.toBytes())
    protoLog.setPubkey(keys.marshalPublicKey(this.hostID.privKey.public))
    req.setLog(protoLog)
    await this.unary(Service.PushLog, req) // as PushLogReply.AsObject
    return
  }
  // GetRecords from a peer.
  async getRecords(id: ThreadID, replicatorKey: Buffer, offsets?: Map<LogID, CID | undefined>, limit?: number) {
    const req = new GetRecordsRequest()
    const entries: GetRecordsRequest.LogEntry[] = []
    req.setFollowkey(replicatorKey)
    req.setThreadid(id.bytes())
    if (offsets) {
      for (const [log, offset] of offsets.entries()) {
        const entry = new GetRecordsRequest.LogEntry()
        const logID = PeerId.createFromB58String(log)
        entry.setLogid(logID.toString())
        offset && entry.setOffset(offset.buffer)
        limit && entry.setLimit(limit)
        entries.push(entry)
      }
    }
    req.setLogsList(entries)
    const header = new GetRecordsRequest.Header()
    header.setFrom(this.hostID.toBytes())
    req.setHeader(header)
    const res = (await this.unary(Service.GetRecords, req)) as GetRecordsReply.AsObject
    const ret: LogEntry[] = []
    for (const entry of res.logsList) {
      const id = Buffer.from(entry.logid as string, 'base64')
      const pid = PeerId.createFromBytes(id)
      ret.push({
        id: pid.toString(),
        records: entry.recordsList.map(record => {
          const rec: LinkRecord = {
            body: Buffer.from(record.bodynode as string, 'base64'),
            header: Buffer.from(record.headernode as string, 'base64'),
            event: Buffer.from(record.eventnode as string, 'base64'),
            record: Buffer.from(record.recordnode as string, 'base64'),
          }
          return rec
        }),
        log: entry.log && protoToLog(entry.log),
      })
    }
    return ret
  }

  async pushRecord(id: ThreadID, log: LogID, record: LinkRecord, node?: Buffer): Promise<void> {
    const req = new PushRecordRequest()
    req.setThreadid(id.bytes())
    const logID = PeerId.createFromB58String(log)
    req.setLogid(logID.toBytes())
    const header = new PushRecordRequest.Header()
    header.setKey(this.hostID.marshalPubKey())
    header.setFrom(this.hostID.toBytes())
    const rec = new Log.Record()
    rec.setBodynode(record.body)
    rec.setEventnode(record.event)
    rec.setHeadernode(record.header)
    record.record && rec.setRecordnode(record.record)
    req.setRecord(rec)
    const bytes = rec.serializeBinary()
    const key: PrivateKey = this.hostID.privKey
    const sig = await key.sign(bytes)
    header.setSignature(sig)
    req.setHeader(header)
    const res = (await this.unary(Service.PushRecord, req)) as PushRecordRequest.AsObject
    return
  }

  private unary<
    TRequest extends grpc.ProtobufMessage,
    TResponse extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<TRequest, TResponse>
  >(methodDescriptor: M, req: TRequest) {
    return new Promise((resolve, reject) => {
      grpc.unary(methodDescriptor, {
        request: req,
        host: this.host,
        onEnd: res => {
          const { status, statusMessage, message } = res
          if (status === grpc.Code.OK) {
            if (message) {
              resolve(message.toObject())
            } else {
              resolve()
            }
          } else {
            reject(new Error(statusMessage))
          }
        },
      })
    })
  }
}
