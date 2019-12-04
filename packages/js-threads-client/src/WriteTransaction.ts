import * as uuid from 'uuid'
import {
  ModelCreateRequest,
  ModelCreateReply,
  ModelSaveRequest,
  ModelDeleteRequest,
  ModelHasRequest,
  ModelHasReply,
  ModelFindRequest,
  ModelFindReply,
  ModelFindByIDReply,
  ModelFindByIDRequest,
  StartTransactionRequest,
  WriteTransactionRequest,
  WriteTransactionReply,
} from '@textile/threads-client-grpc/api_pb'
import { toBase64, fromBase64 } from 'b64-lite'
import { Transaction } from './Transaction'
import { Entity, EntityList } from './models'
import { JSONQuery } from './query'

export class WriteTransaction extends Transaction<WriteTransactionRequest, WriteTransactionReply> {
  public async start() {
    const startReq = new StartTransactionRequest()
    startReq.setStoreid(this.storeID)
    startReq.setModelname(this.modelName)
    const req = new WriteTransactionRequest()
    req.setStarttransactionrequest(startReq)
    this.client.start()
    this.client.send(req)
  }

  public async modelCreate<T = any>(values: any[]) {
    return new Promise<EntityList<T> | undefined>((resolve, reject) => {
      const createReq = new ModelCreateRequest()
      const list: any[] = []
      values.forEach(v => {
        v['ID'] = uuid.v4()
        list.push(JSON.stringify(v))
      })
      createReq.setValuesList(list)
      const req = new WriteTransactionRequest()
      req.setModelcreaterequest(createReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getModelcreatereply()
        if (reply === undefined) {
          resolve()
        } else {
          const ret: EntityList<T> = {
            entitiesList: reply.toObject().entitiesList.map(entity => JSON.parse(entity as string)),
          }
          resolve(ret)
        }
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelSave(values: any[]) {
    return new Promise<void>((resolve, reject) => {
      const saveReq = new ModelSaveRequest()
      const list: any[] = []
      values.forEach(v => {
        if (!v.hasOwnProperty('ID')) {
          v['ID'] = '' // The server will add an ID if empty.
        }
        list.push(JSON.stringify(v))
      })
      saveReq.setValuesList(list)
      const req = new WriteTransactionRequest()
      req.setModelsaverequest(saveReq)
      this.client.onMessage((_message: WriteTransactionReply) => {
        resolve()
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelDelete(entityIDs: string[]) {
    return new Promise<void>((resolve, reject) => {
      const deleteReq = new ModelDeleteRequest()
      deleteReq.setEntityidsList(entityIDs)
      const req = new WriteTransactionRequest()
      req.setModeldeleterequest(deleteReq)
      this.client.onMessage((_message: WriteTransactionReply) => {
        resolve()
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async has(entityIDs: string[]) {
    return new Promise<boolean>((resolve, reject) => {
      const hasReq = new ModelHasRequest()
      hasReq.setEntityidsList(entityIDs)
      const req = new WriteTransactionRequest()
      req.setModelhasrequest(hasReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getModelhasreply()
        resolve(reply ? reply.toObject().exists == true : false)
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelFind<T = any>(query: JSONQuery) {
    return new Promise<EntityList<T>>((resolve, reject) => {
      const findReq = new ModelFindRequest()
      findReq.setQueryjson(toBase64(JSON.stringify(query)))
      const req = new WriteTransactionRequest()
      req.setModelfindrequest(findReq)
      this.client.onMessage((message: WriteTransactionReply) => {
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
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelFindByID<T = any>(entityID: string) {
    return new Promise<Entity<T> | undefined>((resolve, reject) => {
      const findReq = new ModelFindByIDRequest()
      findReq.setEntityid(entityID)
      const req = new WriteTransactionRequest()
      req.setModelfindbyidrequest(findReq)
      this.client.onMessage((message: WriteTransactionReply) => {
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
      super.setReject(reject)
      this.client.send(req)
    })
  }
}
