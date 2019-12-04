/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as uuid from 'uuid'
import { grpc } from '@improbable-eng/grpc-web'
import { API } from '@textile/threads-client-grpc/api_pb_service'
import {
  NewStoreRequest,
  NewStoreReply,
  RegisterSchemaRequest,
  StartRequest,
  StartFromAddressRequest,
  ModelCreateRequest,
  ModelCreateReply,
  ModelSaveRequest,
  ModelDeleteRequest,
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
  ListenRequest,
  ListenReply,
} from '@textile/threads-client-grpc/api_pb'
import { fromBase64, toBase64 } from 'b64-lite'
import * as pack from '../package.json'
import { ReadTransaction } from './ReadTransaction'
import { WriteTransaction } from './WriteTransaction'
import { JSONQuery } from './query'
import { Entity, EntityList } from './models'

export class Client {
  public static version(): string {
    return pack.version
  }

  private readonly host: string

  constructor(host: string, defaultTransport?: grpc.TransportFactory) {
    this.host = host
    const transport = defaultTransport || grpc.WebsocketTransport()
    grpc.setDefaultTransport(transport)
  }

  public async newStore() {
    return this.unary(API.NewStore, new NewStoreRequest()) as Promise<NewStoreReply.AsObject>
  }

  public async registerSchema(storeID: string, name: string, schema: any) {
    const req = new RegisterSchemaRequest()
    req.setStoreid(storeID)
    req.setName(name)
    req.setSchema(JSON.stringify(schema))
    await this.unary(API.RegisterSchema, req)
    return
  }

  public async start(storeID: string) {
    const req = new StartRequest()
    req.setStoreid(storeID)
    await this.unary(API.Start, req)
    return
  }

  public async startFromAddress(storeID: string, address: string, followKey: string, readKey: string) {
    const req = new StartFromAddressRequest()
    req.setStoreid(storeID)
    req.setAddress(address)
    req.setFollowkey(followKey)
    req.setReadkey(readKey)
    await this.unary(API.StartFromAddress, req)
    return
  }

  public async modelCreate<T = any>(storeID: string, modelName: string, values: any[]) {
    const req = new ModelCreateRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    const list: any[] = []
    values.forEach(v => {
      v['ID'] = uuid.v4()
      list.push(JSON.stringify(v))
    })
    req.setValuesList(list)
    const res = (await this.unary(API.ModelCreate, req)) as ModelCreateReply.AsObject
    const ret: EntityList<T> = {
      entitiesList: res.entitiesList.map(entity => JSON.parse(entity as string)),
    }
    return ret
  }

  public async modelSave(storeID: string, modelName: string, values: any[]) {
    const req = new ModelSaveRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    const list: any[] = []
    values.forEach(v => {
      if (!v.hasOwnProperty('ID')) {
        v['ID'] = '' // The server will add an ID if empty.
      }
      list.push(JSON.stringify(v))
    })
    req.setValuesList(list)
    await this.unary(API.ModelSave, req)
    return
  }

  public async modelDelete(storeID: string, modelName: string, entityIDs: string[]) {
    const req = new ModelDeleteRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setEntityidsList(entityIDs)
    await this.unary(API.ModelDelete, req)
    return
  }

  public async modelHas(storeID: string, modelName: string, entityIDs: string[]) {
    const req = new ModelHasRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setEntityidsList(entityIDs)
    const res = (await this.unary(API.ModelHas, req)) as ModelHasReply.AsObject
    return res.exists === true
  }

  public async modelFind<T = any>(storeID: string, modelName: string, query: JSONQuery) {
    const req = new ModelFindRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setQueryjson(toBase64(JSON.stringify(query)))
    const res = (await this.unary(API.ModelFind, req)) as ModelFindReply.AsObject
    const ret: EntityList<T> = {
      entitiesList: res.entitiesList.map(entity => JSON.parse(fromBase64(entity as string))),
    }
    return ret
  }

  public async modelFindByID<T = any>(storeID: string, modelName: string, entityID: string) {
    const req = new ModelFindByIDRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setEntityid(entityID)
    const res = (await this.unary(API.ModelFindByID, req)) as ModelFindByIDReply.AsObject
    const ret: Entity<T> = {
      entity: JSON.parse(res.entity as string),
    }
    return ret
  }

  public readTransaction(storeID: string, modelName: string): ReadTransaction {
    const client = grpc.client(API.ReadTransaction, {
      host: this.host,
    }) as grpc.Client<ReadTransactionRequest, ReadTransactionReply>
    return new ReadTransaction(client, storeID, modelName)
  }

  public writeTransaction(storeID: string, modelName: string): WriteTransaction {
    const client = grpc.client(API.WriteTransaction, {
      host: this.host,
    }) as grpc.Client<WriteTransactionRequest, WriteTransactionReply>
    return new WriteTransaction(client, storeID, modelName)
  }

  public listen<T = any>(storeID: string, modelName: string, entityID: string, callback: (reply: Entity<T>) => void) {
    const req = new ListenRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setEntityid(entityID)
    const client = grpc.client(API.Listen, {
      host: this.host,
    }) as grpc.Client<ListenRequest, ListenReply>
    client.onMessage((message: ListenReply) => {
      const res = message.toObject(true)
      const ret: Entity<T> = {
        entity: JSON.parse(res.entity as string),
      }
      callback(ret)
    })
    client.onEnd((status: grpc.Code, message: string) => {
      if (status !== grpc.Code.OK) {
        throw new Error(message)
      }
    })
    client.start()
    client.send(req)
    // Bind to client here because the close call uses 'this'...
    return client.close.bind(client)
  }

  private async unary<
    TRequest extends grpc.ProtobufMessage,
    TResponse extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<TRequest, TResponse>
  >(methodDescriptor: M, req: TRequest) {
    return new Promise((resolve, reject) => {
      grpc.unary(methodDescriptor, {
        request: req,
        host: this.host,
        onEnd: res => {
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
        },
      })
    })
  }
}

// eslint-disable-next-line import/no-default-export
export default Client
