import { grpc } from '@improbable-eng/grpc-web'
import {
  ModelHasRequest,
  ModelFindRequest,
  ModelFindByIDRequest,
  StartTransactionRequest,
  ReadTransactionRequest,
  ReadTransactionReply,
} from '@textile/threads-client-grpc/api_pb'
import { toBase64, fromBase64 } from 'b64-lite'
import { Transaction } from './Transaction'
import { Entity, EntityList } from './models'
import { JSONQuery } from './models'
import { Config } from './config'

/**
 * ReadTransaction performs a read-only bulk transaction on the underlying store.
 */
export class ReadTransaction extends Transaction<ReadTransactionRequest, ReadTransactionReply> {
  constructor(
    protected readonly config: Config,
    protected readonly client: grpc.Client<ReadTransactionRequest, ReadTransactionReply>,
    protected readonly storeID: string,
    protected readonly modelName: string,
  ) {
    super(client, storeID, modelName)
  }
  /**
   * start begins the transaction. All operations between start and end will be applied as a single transaction upon a call to end.
   */
  public async start() {
    const startReq = new StartTransactionRequest()
    startReq.setStoreid(this.storeID)
    startReq.setModelname(this.modelName)
    const req = new ReadTransactionRequest()
    req.setStarttransactionrequest(startReq)
    const metadata = this.config._wrapBrowserHeaders(new grpc.Metadata())
    this.client.start(metadata)
    this.client.send(req)
  }

  /**
   * has checks whether a given entity exists in the given store.
   * @param entityIDs An array of entity ids to check for.
   */
  public async has(entityIDs: string[]) {
    return new Promise<boolean>((resolve, reject) => {
      const hasReq = new ModelHasRequest()
      hasReq.setEntityidsList(entityIDs)
      const req = new ReadTransactionRequest()
      req.setModelhasrequest(hasReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        const reply = message.getModelhasreply()
        resolve(reply ? reply.toObject().exists == true : false)
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }

  /**
   * modelFind queries the store for entities matching the given query parameters. See Query for options.
   * @param query The object that describes the query. See Query for options. Alternatively, see JSONQuery for the basic interface.
   */
  public async modelFind<T = any>(query: JSONQuery) {
    return new Promise<EntityList<T>>((resolve, reject) => {
      const findReq = new ModelFindRequest()
      findReq.setQueryjson(toBase64(JSON.stringify(query)))
      const req = new ReadTransactionRequest()
      req.setModelfindrequest(findReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        const reply = message.getModelfindreply()
        if (reply === undefined) {
          resolve()
        } else {
          const ret: EntityList<T> = {
            entitiesList: reply.toObject().entitiesList.map(entity => JSON.parse(fromBase64(entity as string))),
          }
          resolve(ret)
        }
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }

  /**
   * modelFindByID queries the store for the id of an entity.
   * @param entityID The id of the entity to search for.
   */
  public async modelFindByID<T = any>(entityID: string) {
    return new Promise<Entity<T>>((resolve, reject) => {
      const findReq = new ModelFindByIDRequest()
      findReq.setEntityid(entityID)
      const req = new ReadTransactionRequest()
      req.setModelfindbyidrequest(findReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        const reply = message.getModelfindbyidreply()
        if (reply === undefined) {
          resolve()
        } else {
          const ret: Entity<T> = {
            entity: JSON.parse(reply.toObject().entity as string),
          }
          resolve(ret)
        }
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }
}
