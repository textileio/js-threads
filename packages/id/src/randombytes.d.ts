declare module '@consento/sync-randombytes' {
  import { Buffer } from 'buffer'

  // eslint-disable-next-line import/no-default-export
  export default function <T extends Uint8Array | Buffer>(input: T): T;
}
