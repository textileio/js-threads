import { grpc } from '@improbable-eng/grpc-web'

export class Transaction<TRequest extends grpc.ProtobufMessage, TResponse extends grpc.ProtobufMessage> {
  protected readonly client: grpc.Client<TRequest, TResponse>
  protected readonly storeID: string
  protected readonly modelName: string

  constructor(client: grpc.Client<TRequest, TResponse>, storeID: string, modelName: string) {
    this.client = client
    this.storeID = storeID
    this.modelName = modelName
  }

  public async end() {
    this.client.close()
  }

  protected setReject(reject: (reason?: any) => void) {
    this.client.onEnd((status: grpc.Code, message: string) => {
      if (status !== grpc.Code.OK) {
        reject(new Error(message))
      }
    })
  }
}
