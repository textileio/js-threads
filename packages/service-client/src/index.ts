import { grpc } from '@improbable-eng/grpc-web'
import CID from 'cids'
import Multiaddr from 'multiaddr'
import PeerId from 'peer-id'
import { keys } from 'libp2p-crypto'
import { ThreadID, ThreadInfo, KeyOptions, LogInfo, Block, RecordInfo, LogRecord } from '@textile/threads-core'
import * as pb from '@textile/threads-service-grpc/api_pb'
import { API } from '@textile/threads-service-grpc/api_pb_service'
import { recordFromProto, recordToProto } from '@textile/threads-encoding'

function getThreadKeys(opts: KeyOptions) {
  const threadKeys = new pb.ThreadKeys()
  opts.replicatorKey && threadKeys.setFollowkey(opts.replicatorKey)
  opts.readKey && threadKeys.setReadkey(opts.readKey)
  opts.logKey && threadKeys.setLogkey(keys.marshalPublicKey(opts.logKey))
  return threadKeys
}

function threadRecordFromProto(proto: pb.NewRecordReply.AsObject, keyiv: Uint8Array) {
  const threadID = ThreadID.fromBytes(Buffer.from(proto.threadid as string, 'base64'))
  const rawID = Buffer.from(proto.logid as string, 'base64')
  const logID = PeerId.createFromBytes(rawID)
  const record = proto.record && recordFromProto(proto.record, keyiv)
  const info: RecordInfo = {
    record,
    threadID,
    logID,
  }
  return info
}

function threadInfoFromProto(proto: pb.ThreadInfoReply.AsObject) {
  const id = ThreadID.fromBytes(Buffer.from(proto.id as string, 'base64'))
  const readKey = Buffer.from(proto.readkey as string, 'base64')
  const replicatorKey = Buffer.from(proto.followkey as string, 'base64')
  const logs: Set<LogInfo> = new Set()
  for (const log of proto.logsList) {
    const rawId = Buffer.from(log.id as string, 'base64')
    const pid = PeerId.createFromBytes(rawId)
    // @todo: Currently it looks like private key unmarshaling isn't compatible between Go and JS?
    // const pkBytes = Buffer.from(log.privkey as string, 'base64')
    // const privKey = await keys.unmarshalPrivateKey(pkBytes)
    const logInfo: LogInfo = {
      id: pid.toString(),
      addrs: new Set(log.addrsList.map(addr => Multiaddr(Buffer.from(addr as string, 'base64')))),
      heads: new Set(log.headsList.map(head => new CID(Buffer.from(head as string, 'base64')))),
      pubKey: keys.unmarshalPublicKey(Buffer.from(log.pubkey as string, 'base64')),
      // privKey,
    }
    logs.add(logInfo)
  }
  const threadInfo: ThreadInfo = {
    id,
    readKey,
    replicatorKey,
    logs,
  }
  return threadInfo
}

/**
 * Client is a web-gRPC wrapper client for communicating with a webgRPC-enabled Textile server.
 * This client library can be used to interact with a local or remote Textile gRPC-service.
 */
export class Client {
  /**
   * Client creates a new gRPC client instance.
   * @param host The local/remote host url. Defaults to 'localhost:7006'.
   * @param defaultTransport The default transport to use when making webgRPC calls. Defaults to WebSockets.
   */
  constructor(private readonly host: string = 'http://localhost:5006', defaultTransport?: grpc.TransportFactory) {
    const transport = defaultTransport || grpc.WebsocketTransport()
    grpc.setDefaultTransport(transport)
  }

  /**
   * getHostID returns the service's (remote) host peer ID.
   */
  async getHostID() {
    const req = new pb.GetHostIDRequest()
    const res = (await this.unary(API.GetHostID, req)) as pb.GetHostIDReply.AsObject
    return PeerId.createFromBytes(Buffer.from(res.peerid as string, 'base64'))
  }

  /**
   * CreateThread with id.
   * @param id The Thread id.
   * @param opts The set of keys to use when creating the Thread. All keys are "optional", though if no replicator key
   * is provided, one will be created (and returned) on the remote service. Similarly, if no LogKey is provided, then
   * a private key will be generated (and returned) on the remote service. If no ReadKey is provided, the remote
   * service will be unable to write records (but it can return records).
   */
  async createThread(id: ThreadID, opts: KeyOptions) {
    const keys = getThreadKeys(opts)
    const req = new pb.CreateThreadRequest()
    req.setThreadid(id.bytes())
    req.setKeys(keys)
    const res = (await this.unary(API.CreateThread, req)) as pb.ThreadInfoReply.AsObject
    const info = threadInfoFromProto(res)
    return info
  }

  /**
   * AddThread from a multiaddress.
   * @param addr The Thread multiaddr.
   * @param opts The set of keys to use when adding the Thread.
   */
  async addThread(addr: Multiaddr, opts: KeyOptions) {
    const keys = getThreadKeys(opts)
    const req = new pb.AddThreadRequest()
    req.setAddr(addr.buffer)
    req.setKeys(keys)
    const res = (await this.unary(API.AddThread, req)) as pb.ThreadInfoReply.AsObject
    const info = threadInfoFromProto(res)
    return info
  }

  /**
   * GetThread with id.
   * @param id The Thread ID.
   */
  async getThread(id: ThreadID) {
    const req = new pb.GetThreadRequest()
    req.setThreadid(id.bytes())
    const res = (await this.unary(API.GetThread, req)) as pb.ThreadInfoReply.AsObject
    const info = threadInfoFromProto(res)
    return info
  }

  /**
   * PullThread for new records.
   * @param id The Thread ID.
   */
  async pullThread(id: ThreadID) {
    const req = new pb.PullThreadRequest()
    req.setThreadid(id.bytes())
    await this.unary(API.PullThread, req)
    return
  }

  /**
   * DeleteThread with id.
   * @param id The Thread ID.
   */
  async deleteThread(id: ThreadID) {
    const req = new pb.DeleteThreadRequest()
    req.setThreadid(id.bytes())
    await this.unary(API.DeleteThread, req)
    return
  }

  /**
   * AddFollower to a thread.
   * @param id The Thread ID.
   * @param addr The multiaddr of the replicator peer.
   */
  async addReplicator(id: ThreadID, addr: Multiaddr) {
    const req = new pb.AddFollowerRequest()
    req.setThreadid(id.bytes())
    req.setAddr(addr.buffer)
    const res = (await this.unary(API.AddFollower, req)) as pb.AddFollowerReply.AsObject
    const rawId = Buffer.from(res.peerid as string, 'base64')
    return PeerId.createFromBytes(rawId)
  }

  async createRecord(id: ThreadID, body: any) {
    const info = await this.getThread(id)
    const block = Block.encoder(body, 'dag-cbor').encode()
    const req = new pb.CreateRecordRequest()
    req.setThreadid(id.bytes())
    req.setBody(block)
    const res = (await this.unary(API.CreateRecord, req)) as pb.NewRecordReply.AsObject
    return info.replicatorKey && threadRecordFromProto(res, info.replicatorKey)
  }

  async addRecord(id: ThreadID, logID: PeerId, rec: LogRecord) {
    const prec = recordToProto(rec)
    const req = new pb.AddRecordRequest()
    req.setThreadid(id.bytes())
    req.setLogid(logID.toBytes())
    const record = new pb.Record()
    record.setBodynode(prec.bodynode)
    record.setEventnode(prec.eventnode)
    record.setHeadernode(prec.headernode)
    record.setRecordnode(prec.recordnode)
    req.setRecord(record)
    await this.unary(API.AddRecord, req)
    return
  }

  async getRecord(id: ThreadID, rec: CID) {
    const info = await this.getThread(id)
    const req = new pb.GetRecordRequest()
    req.setThreadid(id.bytes())
    req.setRecordid(rec.buffer)
    const record = (await this.unary(API.GetRecord, req)) as pb.GetRecordReply.AsObject
    if (!info.replicatorKey) throw new Error('Missing replicatorKey')
    if (!record.record) throw new Error('Missing return value')
    const res = recordFromProto(record.record, info.replicatorKey)
    return res
  }

  subscribe(cb: (rec?: RecordInfo, err?: Error) => void, ...threads: ThreadID[]) {
    const ids = threads.map(thread => thread.bytes())
    const request = new pb.SubscribeRequest()
    request.setThreadidsList(ids)
    const keys = new Map<ThreadID, Uint8Array | undefined>() // replicator key cache
    const callback = async (reply?: pb.NewRecordReply, err?: Error) => {
      if (!reply) {
        return cb(undefined, err)
      }
      const proto = reply.toObject()
      const id = ThreadID.fromBytes(Buffer.from(proto.threadid as string, 'base64'))
      const rawID = Buffer.from(proto.logid as string, 'base64')
      const logID = PeerId.createFromBytes(rawID)
      if (!keys.has(id)) {
        const info = await this.getThread(id)
        keys.set(id, info.replicatorKey)
      }
      const keyiv = keys.get(id)
      if (!keyiv) return cb(undefined, new Error('Missing replicatorKey'))
      const record = proto.record && recordFromProto(proto.record, keyiv)
      return cb(
        {
          record,
          threadID: id,
          logID,
        },
        err,
      )
    }
    return grpc.invoke(API.Subscribe, {
      host: this.host,
      request,
      onMessage: (rec: pb.NewRecordReply) => callback(rec),
      onEnd: (status: grpc.Code, message: string, _trailers: grpc.Metadata) => {
        if (status !== grpc.Code.OK) {
          return callback(undefined, new Error(message))
        }
        callback()
      },
    })
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
