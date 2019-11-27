import {
  ModelHasRequest,
  ModelFindRequest,
  ModelFindByIDRequest,
  StartTransactionRequest,
  ReadTransactionRequest,
  ReadTransactionReply
} from '@textile/threads-client-grpc/api_pb'
import {Transaction} from './Transaction'

export class ReadTransaction extends Transaction<ReadTransactionRequest, ReadTransactionReply> {

  public async start() {
    const startReq = new StartTransactionRequest()
    startReq.setStoreid(super.storeID)
    startReq.setModelname(super.modelName)
    const req = new ReadTransactionRequest()
    req.setStarttransactionrequest(startReq)
    super.client.start()
    super.client.send(req)
  }

  public async has(entityIDs: string[]) {
    return new Promise<boolean>((resolve, reject) => {
      const hasReq = new ModelHasRequest()
      hasReq.setEntityidsList(entityIDs)
      const req = new ReadTransactionRequest()
      req.setModelhasrequest(hasReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        resolve(message.hasModelhasreply())
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelFind() {
    return new Promise<boolean>((resolve, reject) => {
      const findReq = new ModelFindRequest()
      const req = new ReadTransactionRequest()
      req.setModelfindrequest(findReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        resolve(message.hasModelfindreply())
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }

  public async modelFindByID(entityID: string) {
    return new Promise<boolean>((resolve, reject) => {
      const findReq = new ModelFindByIDRequest()
      findReq.setEntityid(entityID)
      const req = new ReadTransactionRequest()
      req.setModelfindrequest(findReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        resolve(message.hasModelfindreply())
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }
}
