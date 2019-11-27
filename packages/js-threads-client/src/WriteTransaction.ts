import * as uuid from 'uuid'
import {
  ModelCreateRequest,
  ModelSaveRequest,
  ModelDeleteRequest,
  ModelHasRequest,
  ModelFindRequest,
  ModelFindByIDRequest,
  StartTransactionRequest,
  WriteTransactionRequest,
  WriteTransactionReply
} from '@textile/threads-client-grpc/api_pb'
import {Transaction} from './Transaction'

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
    return new Promise<boolean>((resolve, reject) => {
      const createReq = new ModelCreateRequest()
      const list: any[] = []
      values.forEach((v) => {
        v['ID'] = uuid.v4()
        list.push(JSON.stringify(v))
      })
      createReq.setValuesList(list)
      const req = new WriteTransactionRequest()
      req.setModelcreaterequest(createReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        resolve(message.hasModelcreatereply())
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelSave(values: any[]) {
    return new Promise<boolean>((resolve, reject) => {
      const saveReq = new ModelSaveRequest()
      const list: any[] = []
      values.forEach((v) => {
        v['ID'] = uuid.v4()
        list.push(JSON.stringify(v))
      })
      saveReq.setValuesList(list)
      const req = new WriteTransactionRequest()
      req.setModelsaverequest(saveReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        resolve(message.hasModelsavereply())
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelDelete(entityIDs: string[]) {
    return new Promise<boolean>((resolve, reject) => {
      const deleteReq = new ModelDeleteRequest()
      deleteReq.setEntityidsList(entityIDs)
      const req = new WriteTransactionRequest()
      req.setModeldeleterequest(deleteReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        resolve(message.hasModeldeletereply())
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
        resolve(message.hasModelhasreply())
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelFind() {
    return new Promise<boolean>((resolve, reject) => {
      const findReq = new ModelFindRequest()
      const req = new WriteTransactionRequest()
      req.setModelfindrequest(findReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        resolve(message.hasModelfindreply())
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelFindByID(entityID: string) {
    return new Promise<boolean>((resolve, reject) => {
      const findReq = new ModelFindByIDRequest()
      findReq.setEntityid(entityID)
      const req = new WriteTransactionRequest()
      req.setModelfindrequest(findReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        resolve(message.hasModelfindreply())
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }
}
