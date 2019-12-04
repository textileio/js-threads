import {
  ModelHasRequest,
  ModelHasReply,
  ModelFindRequest,
  ModelFindReply,
  ModelFindByIDRequest,
  ModelFindByIDReply,
  StartTransactionRequest,
  ReadTransactionRequest,
  ReadTransactionReply,
} from '@textile/threads-client-grpc/api_pb'
import { toBase64, fromBase64 } from 'b64-lite'
import { Transaction } from './Transaction'
import { Entity, EntityList } from './models'
import { JSONQuery } from './query'

export class ReadTransaction extends Transaction<ReadTransactionRequest, ReadTransactionReply> {
  public async start() {
    const startReq = new StartTransactionRequest()
    startReq.setStoreid(this.storeID)
    startReq.setModelname(this.modelName)
    const req = new ReadTransactionRequest()
    req.setStarttransactionrequest(startReq)
    this.client.start()
    this.client.send(req)
  }

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
