/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { grpc } from '@improbable-eng/grpc-web'

export interface BaseConfig {
  host?: string
  transport?: grpc.TransportFactory
}

export class Config {
  constructor(
    public host: string = 'http://127.0.0.1:6007',
    public transport: grpc.TransportFactory = grpc.WebsocketTransport(),
  ) {}

  _wrapMetadata(values?: { [key: string]: any }): { [key: string]: any } | undefined {
    return values
  }
  _wrapBrowserHeaders(values: grpc.Metadata): grpc.Metadata {
    return values
  }
}
