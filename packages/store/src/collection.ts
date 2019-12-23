/* eslint-disable @typescript-eslint/no-var-requires */
import Ajv, { ValidateFunction } from 'ajv'
import { JSONSchema } from 'json-schema-typed'
import { Datastore, Key } from 'interface-datastore'
import { RWLock } from 'async-rwlock'
import uuid from 'uuid'
import mingo from 'mingo'
import { decode } from 'cbor-sync'
import { FilterQuery } from './query/mongodb'
import { Entity, Action, EntityID } from '.'

// @todo: Find or write types for this
const toJsonSchema = require('to-json-schema')
// @todo: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/41011
const { NamespaceDatastore } = require('datastore-core')

const collectionKey = new Key('collection')
const NotActiveError = new Error('Not Started')
const IsActiveError = new Error('Already Started')
// const InvalidIDError = new Error('Invalid Entity ID')
// const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)

export interface ActionHandler<T extends Entity = object> {
  (store: Datastore<any>, actions: Array<Action<T>>): PromiseLike<void> | void
}

export class ReadBatch<T extends Entity = object> {
  protected active = false
  constructor(protected collection: Collection<T>) {}
  // Get returns the given Entity from the store if it exists.
  async get(id: EntityID) {
    if (!this.active) throw NotActiveError
    return decode(await this.collection.datastore.get(new Key(id))) as T
  }

  // Find returns an async iterable of Entities that match the given criteria.
  async *find(query?: FilterQuery<T>) {
    const q = new mingo.Query(query || {})
    for await (const { value } of this.collection.datastore.query({})) {
      const data: T = decode(value) // Decode from CBOR
      if (q.test(data)) {
        yield data
      }
    }
  }

  // Has checks if the given Entity is in the store.
  async has(id: EntityID) {
    if (!this.active) throw NotActiveError
    return this.collection.datastore.has(new Key(id))
  }

  async start(timeout?: number) {
    if (this.active) throw IsActiveError
    await this.collection.lock.readLock(timeout)
    this.active = true
    return this
  }

  discard() {
    if (!this.active) throw NotActiveError
    this.active = false
    return this.collection.lock.unlock()
  }
}

export class WriteBatch<T extends Entity = object> extends ReadBatch<T> {
  // @todo: This is all very inefficient, we should use a local tree to store deletes and writes
  private actions: Array<Action<T>> = []
  private ids: Set<string> = new Set()
  async start(timeout?: number) {
    if (this.active) throw IsActiveError
    await this.collection.lock.writeLock(timeout)
    this.active = true
    return this
  }

  async create(entity: T) {
    if (!this.active) throw NotActiveError
    if (!this.collection.validator(entity)) throw new Error('Schema Validation')
    // if (entity.ID && !isUUID(entity.ID)) throw InvalidIDError
    const id = entity.ID || uuid()
    const key = new Key(id)
    if ((await this.collection.datastore.has(key)) || this.ids.has(id)) {
      throw new Error('Existing Entity')
    }
    const current = { ...entity, ID: id } as T
    const action: Action<T> = {
      type: Action.Type.Create,
      entityID: id,
      collectionName: this.collection.name,
      previous: undefined,
      current,
    }
    this.ids.add(id)
    this.actions.push(action)
    return current
  }

  async delete(id: EntityID) {
    if (!this.active) throw NotActiveError
    // if (!isUUID(id)) throw InvalidIDError
    const key = new Key(id)
    if (!(await this.collection.datastore.has(key))) {
      if (this.ids.has(id)) {
        // Remove from cache
        this.actions = this.actions.filter(item => item.entityID !== id)
        this.ids.delete(id)
        return
      } else {
        throw new Error('Not Found')
      }
    }
    const action: Action<T> = {
      type: Action.Type.Delete,
      entityID: id,
      collectionName: this.collection.name,
      previous: undefined, // @todo: Should this maybe be the current value rather than undefined?
      current: undefined,
    }
    this.ids.add(id)
    this.actions.push(action)
  }

  // Get returns existing Entities from the store.
  async get(id: EntityID) {
    if (!this.active) throw NotActiveError
    const last = [...this.actions]
      .slice()
      .reverse()
      .find(item => item.entityID === id)
    if (last) {
      if (last.type === Action.Type.Delete) {
        throw new Error('Entity Deleted')
      }
      return last.current as T
    }
    return super.get(id)
  }

  // Has checks if the given Entities are in the store.
  async has(id: EntityID) {
    if (!this.active) throw NotActiveError
    const deleted = [...this.actions]
      .filter(action => action.type === Action.Type.Delete)
      .map(action => action.entityID)
    return !deleted.includes(id) && (this.ids.has(id) || (await super.has(id)))
  }

  // Find returns an async iterable of Entities that match the given criteria.
  async *find(query?: FilterQuery<T>) {
    if (!this.active) throw NotActiveError
    const deleted = [...this.actions]
      .filter(action => action.type === Action.Type.Delete)
      .map(action => action.entityID)
    const created = [...this.actions].filter(action => action.type === Action.Type.Create)
    const updated = [...this.actions]
      .filter(action => action.type === Action.Type.Save)
      .slice()
      .reverse()
    const q = new mingo.Query(query || {})
    for await (const { key, value } of this.collection.datastore.query({})) {
      const data: T = decode(value) // Decode from CBOR
      const k = key.toString()
      // If it passes the test, but hasn't been deleted in the current transaction...
      if (q.test(data) && !deleted.includes(k)) {
        const found = updated.find(action => action.entityID === k)
        // If we've updated the item in this transaction...
        if (found && found.current) {
          // And it still passes, yield it
          if (q.test(found.current)) yield found.current
        } else yield data // Otherwise, yield the orginal
      }
    }
    // For any new items, yield them if they pass
    for (const action of created) {
      if (action.current && q.test(action.current)) yield action.current
    }
  }

  discard() {
    this.actions = []
    this.ids.clear()
    super.discard()
  }

  async commit() {
    if (!this.active) throw NotActiveError
    if (this.actions.length > 0) {
      await this.collection.handler(this.collection.datastore, this.actions)
    }
    return this.discard()
  }
}

/**
 * Collection contains instances of a Schema, and provides operations for creating, updating, deleting, and quering.
 */
export class Collection<T extends Entity = object> {
  readonly lock: RWLock = new RWLock()
  // @todo: Should datastore be private? We'd have to change Batch implementations
  constructor(
    public name: string,
    readonly validator: ValidateFunction,
    readonly handler: ActionHandler<T>,
    readonly datastore: Datastore<Buffer>,
  ) {
    // Scoped namespace keeps our transactions isolated
    // key = <...>/collection/<collection-name>/<entity-id>
    this.datastore = new NamespaceDatastore(datastore, collectionKey.child(new Key(name)))
  }

  /**
   * FromSchema creates a new empty Collection from an input JSONSchema.
   * @param name A name for the Collection.
   * @param schema A valid JSONSchema object.
   */
  static fromSchema<T extends Entity = object>(
    name: string,
    schema: JSONSchema,
    handler: ActionHandler,
    datastore: Datastore,
  ) {
    return new Collection<T>(name, new Ajv().compile(schema), handler, datastore)
  }

  /**
   * FromObject creates a new Collection from an input object.
   * It will attempt to infer the JSONSchema from the input object.
   * @param name A name for the Collection.
   * @param schema A valid JSONS object.
   */
  static fromObject<T extends Entity = object>(name: string, obj: T, handler: ActionHandler, datastore: Datastore) {
    const schema = toJsonSchema(obj) as JSONSchema
    return this.fromSchema(name, schema, handler, datastore)
  }

  // Find returns an async iterable of Entities that match the given criteria.
  async *find(query?: FilterQuery<T>) {
    const batch = await this.batch(false).start()
    for await (const entity of batch.find(query)) yield entity
    batch.discard()
  }

  async create(entities: T): Promise<T>
  async create(...entities: T[]): Promise<T[]>
  async create(...entities: T[]) {
    const batch = await this.batch(true).start()
    const results = await Promise.all<T>(entities.map(batch.create.bind(batch)))
    await batch.commit()
    return results.length > 1 ? results : results.pop()
  }

  async delete(...ids: EntityID[]) {
    const batch = await this.batch(true).start()
    await Promise.all<void>(ids.map(batch.delete.bind(batch)))
    return await batch.commit()
  }

  // Get returns the given Entity from the store if it exists.
  async get(id: EntityID): Promise<T>
  async get(...ids: EntityID[]): Promise<T[]>
  async get(...ids: EntityID[]) {
    const batch = await this.batch(false).start()
    const results = await Promise.all<T>(ids.map(async id => batch.get(id)))
    batch.discard()
    return results.length > 1 ? results : results.pop()
  }

  // Has checks if the given Entity is in the store.
  async has(id: EntityID): Promise<boolean>
  async has(...ids: EntityID[]): Promise<boolean[]>
  async has(...ids: EntityID[]) {
    const batch = await this.batch(false).start()
    const results = await Promise.all<boolean>(ids.map(async id => batch.has(id)))
    batch.discard()
    return results.length > 1 ? results : results.pop()
  }

  batch<W extends boolean = false>(write?: W): W extends true ? WriteBatch<T> : ReadBatch<T>
  batch<W extends boolean = false>(write?: W): WriteBatch<T> | ReadBatch<T> {
    return write ? new WriteBatch<T>(this) : new ReadBatch<T>(this)
  }
}
