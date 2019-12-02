import * as uuid from 'uuid'
import {
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
  ModelFindByIDReply,
  ModelFindByIDRequest,
  StartTransactionRequest,
  WriteTransactionRequest,
  WriteTransactionReply,
} from '@textile/threads-client-grpc/api_pb'
import { Transaction } from './Transaction'

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

  public async modelCreate(values: any[]) {
    return new Promise<ModelCreateReply.AsObject>((resolve, reject) => {
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
        resolve(reply ? reply.toObject() : undefined)
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
    return new Promise<ModelHasReply.AsObject>((resolve, reject) => {
      const hasReq = new ModelHasRequest()
      hasReq.setEntityidsList(entityIDs)
      const req = new WriteTransactionRequest()
      req.setModelhasrequest(hasReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getModelhasreply()
        resolve(reply ? reply.toObject() : undefined)
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelFind() {
    return new Promise<ModelFindReply.AsObject>((resolve, reject) => {
      const findReq = new ModelFindRequest()
      const req = new WriteTransactionRequest()
      req.setModelfindrequest(findReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getModelfindreply()
        resolve(reply ? reply.toObject() : undefined)
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelFindByID(entityID: string) {
    return new Promise<ModelFindByIDReply.AsObject>((resolve, reject) => {
      const findReq = new ModelFindByIDRequest()
      findReq.setEntityid(entityID)
      const req = new WriteTransactionRequest()
      req.setModelfindbyidrequest(findReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getModelfindbyidreply()
        resolve(reply ? reply.toObject() : undefined)
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }
}
