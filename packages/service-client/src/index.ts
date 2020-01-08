import { grpc } from '@improbable-eng/grpc-web'
import Multiaddr from 'multiaddr'
import {
  GetLogsRequest,
  GetLogsReply,
  Log as ProtoLog,
  PushLogRequest,
  GetRecordsReply,
  GetRecordsRequest,
} from '@textile/threads-service-grpc/service_pb'
import { Service } from '@textile/threads-service-grpc/service_pb_service'
import CID from 'cids'
import { ThreadID, LogID, LogInfo, Network, LogEntry, Log } from '@textile/threads-core'

const protoToLog = (protoLog: ProtoLog.AsObject) => {
  const log: Log = {
    id: protoLog.id.toString(),
    addrs: protoLog.addrsList.map(addr => Multiaddr(Buffer.from(addr as string))),
    heads: protoLog.headsList.map(head => new CID(Buffer.from(head as string))),
    pubKey: Buffer.from(protoLog.pubkey as string),
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
    private hostID: string,
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
    header.setFrom(this.hostID)
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
    req.setThreadid(id.string())
    const header = new GetLogsRequest.Header()
    header.setFrom(this.hostID)
    req.setHeader(header)
    const protoLog = new ProtoLog()
    protoLog.setAddrsList([...(log.addrs || [])].map(item => item.buffer))
    protoLog.setHeadsList([...(log.heads || [])].map(item => item.buffer))
    protoLog.setId(log.id)
    protoLog.setPubkey(log.pubKey.bytes)
    req.setLog(protoLog)
    await this.unary(Service.PushLog, req) // as PushLogReply.AsObject
    return
  }
  // GetRecords from a peer.
  async getRecords(id: ThreadID, replicatorKey: Buffer, offsets?: Map<LogID, CID>, limit?: number) {
    const req = new GetRecordsRequest()
    const entries: GetRecordsRequest.LogEntry[] = []
    req.setFollowkey(replicatorKey)
    req.setThreadid(id.string())
    if (offsets) {
      for (const [log, offset] of offsets.entries()) {
        const entry = new GetRecordsRequest.LogEntry()
        entry.setLogid(log)
        entry.setOffset(offset.buffer)
        entry.setLimit(limit || 0)
        entries.push(entry)
      }
    }
    req.setLogsList(entries)
    const header = new GetRecordsRequest.Header()
    header.setFrom(this.hostID)
    req.setHeader(header)
    const res = (await this.unary(Service.GetRecords, req)) as GetRecordsReply.AsObject
    const ret: LogEntry[] = []
    for (const entry of res.logsList) {
      ret.push({
        ID: entry.logid as string,
        records: entry.recordsList,
        log: entry.log && protoToLog(entry.log),
      })
    }
    return ret
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
