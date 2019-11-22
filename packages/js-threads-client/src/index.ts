import * as uuid from 'uuid'
import {grpc} from '@improbable-eng/grpc-web'
import {API} from '@textile/threads-api-pb/api_pb_service'
import {
  NewStoreRequest,
  RegisterSchemaRequest,
  ModelCreateRequest
} from '@textile/threads-api-pb/api_pb'
import {ProtobufMessage} from '@improbable-eng/grpc-web/dist/typings/message'
import {UnaryMethodDefinition} from '@improbable-eng/grpc-web/dist/typings/service'

const pack = require('../package.json')

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
    return this.unary(API.NewStore, new NewStoreRequest())
  }

  public async registerSchema(storeID: string, name: string, schema: any) {
    const req = new RegisterSchemaRequest()
    req.setStoreid(storeID)
    req.setName(name)
    req.setSchema(JSON.stringify(schema))
    return this.unary(API.RegisterSchema, req)
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

    return this.unary(API.ModelCreate, req)
  }

  private async unary<TRequest extends ProtobufMessage, TResponse extends ProtobufMessage, M extends UnaryMethodDefinition<TRequest, TResponse>>(
      methodDescriptor: M, req: TRequest) {
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
