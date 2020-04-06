/**
 * @packageDocumentation
 * @module @textile/threads-client/models
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { grpc } from '@improbable-eng/grpc-web'

/**
 * @hidden
 */
export interface BaseConfig {
  host?: string
  transport?: grpc.TransportFactory
}

/**
 * The default config required to connect to localhost Threads daemon
 */
export class Config {
  constructor(
    /** The Threads daemon host path and port */
    public host: string = 'http://127.0.0.1:6007',
    /** Override the default API transport. For advanced usage only. */
    public transport: grpc.TransportFactory = grpc.WebsocketTransport(),
  ) {}

  /** @internal */
  _wrapMetadata(values?: { [key: string]: any }): { [key: string]: any } | undefined {
    return values
  }
  /** @internal */
  _wrapBrowserHeaders(values: grpc.Metadata): grpc.Metadata {
    return values
  }
}
