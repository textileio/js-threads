import * as uuid from 'uuid'
import {grpc} from '@improbable-eng/grpc-web'
import {API} from '@textile/threads-client-grpc/api_pb_service'
import {
  NewStoreRequest,
  NewStoreReply,
  RegisterSchemaRequest,
  RegisterSchemaReply,
  StartRequest,
  StartReply,
  StartFromAddressRequest,
  StartFromAddressReply,
  ModelCreateRequest,
  ModelCreateReply,
  ModelSaveRequest,
  ModelSaveReply,
  ModelDeleteRequest,
  ModelDeleteReply,
  ModelHasRequest,
  ModelHasReply,
  ModelFindRequest,
  ModelFindReply,
  ModelFindByIDRequest,
  ModelFindByIDReply,
  ReadTransactionRequest,
  ReadTransactionReply,
  WriteTransactionRequest,
  WriteTransactionReply,
  ListenRequest
} from '@textile/threads-client-grpc/api_pb'
import {ReadTransaction} from './ReadTransaction'
import {WriteTransaction} from './WriteTransaction'

const pack = require('../package.json')

// interface Response<T extends grpc.ProtobufMessage> {
//   onMessage(callback: (message: T) => void): void
//   onError(callback: (status: string) => void): void
// }

export class Client {

  public static version(): string {
    return pack.version
  }

  private host: string | undefined
  // private subscriptions: Record<string, Subscription> = {}

  constructor() {
    grpc.setDefaultTransport(grpc.FetchReadableStreamTransport({
      credentials: 'omit'
    }))
    // grpc.setDefaultTransport(grpc.WebsocketTransport())
  }

  public setHost(host: string) {
    this.host = host
    return this
  }

  public async newStore() {
    return this.unary(API.NewStore, new NewStoreRequest()) as Promise<NewStoreReply.AsObject>
  }

  public async registerSchema(storeID: string, name: string, schema: any) {
    const req = new RegisterSchemaRequest()
    req.setStoreid(storeID)
    req.setName(name)
    req.setSchema(JSON.stringify(schema))
    return this.unary(API.RegisterSchema, req) as Promise<RegisterSchemaReply.AsObject>
  }

  public async start(storeID: string) {
    const req = new StartRequest()
    req.setStoreid(storeID)
    return this.unary(API.Start, req) as Promise<StartReply.AsObject>
  }

  public async startFromAddress(storeID: string, address: string, followKey: string, readKey: string) {
    const req = new StartFromAddressRequest()
    req.setStoreid(storeID)
    req.setAddress(address)
    req.setFollowkey(followKey)
    req.setReadkey(readKey)
    return this.unary(API.StartFromAddress, req) as Promise<StartFromAddressReply.AsObject>
  }

  public async modelCreate(storeID: string, modelName: string, values: any[]) {
    const req = new ModelCreateRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    const list: any[] = []
    values.forEach((v) => {
      v['ID'] = uuid.v4()
      list.push(JSON.stringify(v))
    })
    req.setValuesList(list)
    return this.unary(API.ModelCreate, req) as Promise<ModelCreateReply.AsObject>
  }

  public async modelSave(storeID: string, modelName: string, values: any[]) {
    const req = new ModelSaveRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    const list: any[] = []
    values.forEach((v) => {
      v['ID'] = uuid.v4()
      list.push(JSON.stringify(v))
    })
    req.setValuesList(list)
    return this.unary(API.ModelSave, req) as Promise<ModelSaveReply.AsObject>
  }

  public async modelDelete(storeID: string, modelName: string, entityIDs: string[]) {
    const req = new ModelDeleteRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setEntityidsList(entityIDs)
    return this.unary(API.ModelDelete, req) as Promise<ModelDeleteReply.AsObject>
  }

  public async modelHas(storeID: string, modelName: string, entityIDs: string[]) {
    const req = new ModelHasRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setEntityidsList(entityIDs)
    return this.unary(API.ModelHas, req) as Promise<ModelHasReply.AsObject>
  }

  public async modelFind(storeID: string, modelName: string) {
    const req = new ModelFindRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    return this.unary(API.ModelFind, req) as Promise<ModelFindReply.AsObject>
  }

  public async modelFindByID(storeID: string, modelName: string, entityID: string) {
    const req = new ModelFindByIDRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setEntityid(entityID)
    return this.unary(API.ModelFindByID, req) as Promise<ModelFindByIDReply.AsObject>
  }

  public readTransaction(storeID: string, modelName: string): ReadTransaction | undefined {
    if (!this.host) {
      return
    }
    const client = grpc.client(API.ReadTransaction, {
      host: this.host
    }) as grpc.Client<ReadTransactionRequest, ReadTransactionReply>
    return new ReadTransaction(client, storeID, modelName)
  }

  public writeTransaction(storeID: string, modelName: string): WriteTransaction | undefined {
    if (!this.host) {
      return
    }
    const client = grpc.client(API.WriteTransaction, {
      host: this.host!
    }) as grpc.Client<WriteTransactionRequest, WriteTransactionReply>
    return new WriteTransaction(client, storeID, modelName)
  }

  public async listen(storeID: string, modelName: string, entityID: string) {
    const req = new ListenRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setEntityid(entityID)
    // return this.client(API.Listen, req)
  }

  private async unary<
    TRequest extends grpc.ProtobufMessage,
    TResponse extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<TRequest, TResponse>>(methodDescriptor: M, req: TRequest) {
    return new Promise((resolve, reject) => {
      if (!this.host) {
        reject(new Error('host URL is not set'))
        return
      }
      grpc.unary(methodDescriptor, {
        request: req,
        host: this.host,
        onEnd: (res) => {
          const { status, statusMessage, headers, message, trailers } = res
          if (status === grpc.Code.OK) {
            if (message) {
              resolve(message.toObject())
            } else {
              resolve()
            }
          } else {
            reject(new Error(statusMessage))
          }
        }
      })
    })
  }
}

export default new Client()
