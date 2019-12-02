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
import { Transaction } from './Transaction'

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
    return new Promise<ModelHasReply.AsObject>((resolve, reject) => {
      const hasReq = new ModelHasRequest()
      hasReq.setEntityidsList(entityIDs)
      const req = new ReadTransactionRequest()
      req.setModelhasrequest(hasReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        const reply = message.getModelhasreply()
        resolve(reply ? reply.toObject() : undefined)
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelFind() {
    return new Promise<ModelFindReply.AsObject>((resolve, reject) => {
      const findReq = new ModelFindRequest()
      const req = new ReadTransactionRequest()
      req.setModelfindrequest(findReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        const reply = message.getModelfindreply()
        resolve(reply ? reply.toObject() : undefined)
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelFindByID(entityID: string) {
    return new Promise<ModelFindByIDReply.AsObject>((resolve, reject) => {
      const findReq = new ModelFindByIDRequest()
      findReq.setEntityid(entityID)
      const req = new ReadTransactionRequest()
      req.setModelfindbyidrequest(findReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        const reply = message.getModelfindbyidreply()
        resolve(reply ? reply.toObject() : undefined)
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }
}
