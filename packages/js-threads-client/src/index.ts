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
  GetStoreLinkRequest,
  GetStoreLinkReply,
} from '@textile/threads-client-grpc/api_pb'
import { encode, decode } from 'bs58'
import * as pack from '../package.json'
import { ReadTransaction } from './ReadTransaction'
import { WriteTransaction } from './WriteTransaction'
import { JSONQuery, Entity, EntityList } from './models'

export { JSONQuery, Entity, EntityList }
export { Query, Where } from './query'

/**
 * Client is a web-gRPC wrapper client for communicating with a webgRPC-enabled Textile server.
 * This client library can be used to interact with a local or remote Textile gRPC-service
 *  It is a wrapper around Textile's 'Store' API, which is defined here: https://github.com/textileio/go-textile-threads/blob/master/api/pb/api.proto.
 */
export class Client {
  /**
   * version is the release version.
   */
  public static version(): string {
    return pack.version
  }

  /**
   * host is the (private) remote host address.
   */
  private readonly host: string

  /**
   * Client creates a new gRPC client instance.
   * @param host The local/remote host url. Defaults to 'localhost:9091'.
   * @param defaultTransport The default transport to use when making webgRPC calls. Defaults to WebSockets.
   */
  constructor(host: string, defaultTransport?: grpc.TransportFactory) {
    this.host = host
    const transport = defaultTransport || grpc.WebsocketTransport()
    grpc.setDefaultTransport(transport)
  }

  /**
   * newStore creates a new store on the remote node.
   */
  public async newStore() {
    return this.unary(API.NewStore, new NewStoreRequest()) as Promise<NewStoreReply.AsObject>
  }

  /**
   * registerSchema registers a new model schema under the given name on the remote node.
   * The schema must be a valid json-schema.org schema, and can be a JSON string or Javascript object.
   * @param storeID The id of the store with which to register the new model.
   * @param name The human-readable name for the model.
   * @param schema The actual json-schema.org compatible schema object.
   */
  public async registerSchema(storeID: string, name: string, schema: any) {
    const req = new RegisterSchemaRequest()
    req.setStoreid(storeID)
    req.setName(name)
    req.setSchema(JSON.stringify(schema))
    await this.unary(API.RegisterSchema, req)
    return
  }

  /**
   * start initializes the client with the given store.
   * It should be called immediatelly after registering all schemas and before any operation on
   * the store.
   * @param storeID The id of the store with which to register.
   */
  public async start(storeID: string) {
    const req = new StartRequest()
    req.setStoreid(storeID)
    await this.unary(API.Start, req)
    return
  }

  /**
   * startFromAddress initializes the client with the given store, connecting to the given
   * thread address (database). It should be called before any operation on the store, and is an
   * alternative to start, which creates a local store. startFromAddress should also include the
   * read and follow keys, which should be Buffer, Uint8Array or base58-encoded strings.
   * See `getStoreLink` for a possible source of the address and keys.
   * @param storeID The id of the store with which to register.
   * @param address The address for the thread with which to connect.
   * Should be of the form /ip4/<url/ip-address>/tcp/<port>/p2p/<peer-id>/thread/<thread-id>
   * @param followKey Symmetric key. Uint8Array or base58-encoded string of length 44 bytes.
   * @param readKey Symmetric key. Uint8Array or base58-encoded string of length 44 bytes.
   */
  public async startFromAddress(
    storeID: string,
    address: string,
    followKey: string | Uint8Array,
    readKey: string | Uint8Array,
  ) {
    const req = new StartFromAddressRequest()
    req.setStoreid(storeID)
    req.setAddress(address)
    req.setFollowkey(typeof followKey === 'string' ? decode(followKey) : followKey)
    req.setReadkey(typeof readKey === 'string' ? decode(readKey) : readKey)
    await this.unary(API.StartFromAddress, req)
    return
  }

  /**
   * getStoreLink returns invite 'links' unseful for inviting other peers to join a given store/thread.
   * @param storeID The id of the store for which to create the invite.
   */
  public async getStoreLink(storeID: string) {
    const req = new GetStoreLinkRequest()
    req.setStoreid(storeID)
    const res = (await this.unary(API.GetStoreLink, req)) as GetStoreLinkReply.AsObject
    const invites = []
    for (const addr of res.addressesList) {
      const fk = Buffer.from(res.followkey as string, 'base64')
      const rk = Buffer.from(res.readkey as string, 'base64')
      invites.push(`${addr}?${encode(fk)}&${encode(rk)}`)
    }
    return invites
  }

  /**
   * modelCreate creates a new model instance in the given store.
   * @param storeID The id of the store in which create the new instance.
   * @param modelName The human-readable name of the model to use.
   * @param values An array of model instances as JSON/JS objects.
   */
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

  /**
   * modelSave saves changes to an existing model instance in the given store.
   * @param storeID The id of the store in which the existing instance will be saved.
   * @param modelName The human-readable name of the model to use.
   * @param values An array of model instances as JSON/JS objects. Each model instance must have a valid existing `ID` property.
   */
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

  /**
   * modelDelete deletes an existing model instance from the given store.
   * @param storeID The id of the store from which to remove the given instances.
   * @param modelName The human-readable name of the model to use.
   * @param entityIDs An array of entity ids to delete.
   */
  public async modelDelete(storeID: string, modelName: string, entityIDs: string[]) {
    const req = new ModelDeleteRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setEntityidsList(entityIDs)
    await this.unary(API.ModelDelete, req)
    return
  }

  /**
   * modelHas checks whether a given entity exists in the given store.
   * @param storeID The id of the store in which to check inclusion.
   * @param modelName The human-readable name of the model to use.
   * @param entityIDs An array of entity ids to check for.
   */
  public async modelHas(storeID: string, modelName: string, entityIDs: string[]) {
    const req = new ModelHasRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    req.setEntityidsList(entityIDs)
    const res = (await this.unary(API.ModelHas, req)) as ModelHasReply.AsObject
    return res.exists
  }

  /**
   * modelFind queries the store for entities matching the given query parameters. See Query for options.
   * @param storeID The id of the store on which to perform the query.
   * @param modelName The human-readable name of the model to use.
   * @param query The object that describes the query. See Query for options. Alternatively, see JSONQuery for the basic interface.
   */
  public async modelFind<T = any>(storeID: string, modelName: string, query: JSONQuery) {
    const req = new ModelFindRequest()
    req.setStoreid(storeID)
    req.setModelname(modelName)
    // @todo: Find a more isomorphic way to do this base64 round-trip
    req.setQueryjson(Buffer.from(JSON.stringify(query)).toString('base64'))
    const res = (await this.unary(API.ModelFind, req)) as ModelFindReply.AsObject
    const ret: EntityList<T> = {
      entitiesList: res.entitiesList.map(entity => JSON.parse(Buffer.from(entity as string, 'base64').toString())),
    }
    return ret
  }

  /**
   * modelFindByID queries the store for the id of an entity.
   * @param storeID The id of the store on which to perform the query.
   * @param modelName The human-readable name of the model to use.
   * @param entityID The id of the entity to search for.
   */
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

  /**
   * readTransaction creates a new read-only transaction object. See ReadTransaction for details.
   * @param storeID The id of the store on which to perform the transaction.
   * @param modelName The human-readable name of the model to use.
   */
  public readTransaction(storeID: string, modelName: string): ReadTransaction {
    const client = grpc.client(API.ReadTransaction, {
      host: this.host,
    }) as grpc.Client<ReadTransactionRequest, ReadTransactionReply>
    return new ReadTransaction(client, storeID, modelName)
  }

  /**
   * writeTransaction creates a new writeable transaction object. See WriteTransaction for details.
   * @param storeID The id of the store on which to perform the transaction.
   * @param modelName The human-readable name of the model to use.
   */
  public writeTransaction(storeID: string, modelName: string): WriteTransaction {
    const client = grpc.client(API.WriteTransaction, {
      host: this.host,
    }) as grpc.Client<WriteTransactionRequest, WriteTransactionReply>
    return new WriteTransaction(client, storeID, modelName)
  }

  /**
   * listen opens a long-lived connection with a remote node, running the given callback on each new update to the given entity.
   * The return value is a `close` function, which cleanly closes the connection with the remote node.
   * @param storeID The id of the store on which to open the connection.
   * @param modelName The human-readable name of the model to use.
   * @param entityID The id of the entity to monitor.
   * @param callback The callback to call on each update to the given entity.
   */
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

// eslint-disable-next-line import/no-default-export
export default Client
