export * from '@consento/sync-randombytes'

export { KeyType } from './keys.proto'

/**
 * Generic public key interface.
 */
export interface PublicKey {
  /**
   * A protobuf serialized representation of this key.
   */
  readonly bytes: Buffer
  /**
   * Verify the signature of the given message data.
   * @param data The data whose signature is to be verified.
   * @param sig The signature to verify.
   */
  verify(data: Buffer, sig: Buffer): Promise<boolean>
  /**
   * Return the raw bytes of this key. Not to be conused with `bytes`.
   */
  marshal(): Buffer
  /**
   * Test for equality with another key.
   * @param key Other key.
   */
  equals(key: PublicKey): boolean
  /**
   * Compute the sha256 hash of the key's `bytes`.
   */
  hash(): Promise<Buffer>
}

/**
 * Generic private key interface.
 */
export interface PrivateKey {
  /**
   * The public key associated with this private key.
   */
  readonly public: PublicKey
  /**
   * A protobuf serialized representation of this key.
   */
  readonly bytes: Buffer
  /**
   * Generates a digital signature on the given data.
   * @param data The data to sign.
   */
  sign(data: Buffer): Promise<Buffer>
  /**
   * Return the raw bytes of this key. Not to be conused with `bytes`.
   */
  marshal(): Buffer
  /**
   * Test for equality with another key.
   * @param key Other key.
   */
  equals(key: PrivateKey): boolean
  /**
   * Compute the sha256 hash of the key's `bytes`.
   */
  hash(): Promise<Buffer>
  /**
   * Gets the ID of the key.
   *
   * The key id is the base58 encoding of the SHA-256 multihash of its public key.
   * The public key is a protobuf encoding containing a type and the DER encoding
   * of the PKCS SubjectPublicKeyInfo.
   */
  id(): Promise<string>
}
