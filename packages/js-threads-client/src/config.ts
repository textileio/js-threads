/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { grpc } from '@improbable-eng/grpc-web'

export class Config {
  public host: string
  public transport: grpc.TransportFactory

  private session?: string
  constructor(host?: string, transport?: grpc.TransportFactory) {
    this.host = host || 'http://127.0.0.1:6007'
    this.transport = transport || grpc.WebsocketTransport()
  }

  _wrapMetadata(values?: { [key: string]: any }): { [key: string]: any } | undefined {
    if (!this.session) {
      return values
    }
    const response = values ?? {}
    if ('Authorization' in response || 'authorization' in response) {
      return response
    }
    response['Authorization'] = `Bearer ${this.session}`
    return response
  }
  _wrapBrowserHeaders(values: grpc.Metadata): grpc.Metadata {
    if (!this.session) {
      return values
    }
    values.set('Authorization', `Bearer ${this.session}`)
    return values
  }
}
