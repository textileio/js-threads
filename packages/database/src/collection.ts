import { Datastore, Key, Query, MemoryDatastore, Result } from 'interface-datastore'
import { EventEmitter } from 'tsee'
import Ajv, { ValidateFunction, ValidationError } from 'ajv'
import uuid from 'uuid'
import { reduce } from 'streaming-iterables'
import mingo from 'mingo'
import { JSONSchema3or4 as JSONSchema } from 'to-json-schema'
import { Dispatcher, JsonPatchStore, Entity } from '@textile/threads-store'
import { FilterQuery } from './query'

// Resolve the value of the field (dot separated) on the given object
const dot = mingo._internal().resolve

// Setup the key field for our collection
mingo.setup({
  key: 'ID',
})

export const existingKeyError = new Error('Existing key')

/**
 * Events for a collection's EventEmitter
 */
type Events<T> = {}

interface FindOptions<T extends Entity> extends Pick<Query<T>, 'limit' | 'offset' | 'keysOnly'> {
  sort?: {
    [key in keyof T]?: 1 | -1
  }
}

/**
 * Options for creating a new collection.
 */
export interface Options<T extends Entity> {
  child: Datastore<T>
  dispatcher: Dispatcher
}

const defaultOptions: Options<any> = {
  child: new MemoryDatastore(),
  dispatcher: new Dispatcher(),
}

const cmp = (a: any, b: any, asc: 1 | -1 = 1) => {
  if (a < b) return -1 * asc
  if (a > b) return 1 * asc
  return 0
}

// Entities/Documents

const handler = <T extends Entity>(obj: T) => {
  return {
    get: (target: T | Document<T>, property: keyof T, _receiver: any) => {
      if (Reflect.has(obj, property)) {
        return Reflect.get(obj, property)
      } else if (!Reflect.has(target, property)) {
        throw Error(`Property ${property} does not exist`)
      }
      return Reflect.get(target, property)
    },
    set: (_target: T | Document<T>, property: keyof T, value: any, _receiver: any) => {
      return Reflect.set(obj, property, value)
    },
  }
}

/**
 * Document is a wrapper around a collection and a (proxy to) an entity object.
 */
export class Document<T extends Entity = any> {
  constructor(private _collection: Collection<T>, private _data: T) {
    return new Proxy<Document<T>>(this, handler(this._data))
  }

  /**
   * Save this entity to its parent collection.
   */
  save() {
    return this._collection.save(this._data)
  }
}

// Collections

export interface Collection<T extends Entity = any> {
  <T extends Entity>(data: Partial<T>): Document<T> & T
  new <T extends Entity>(data: Partial<T>): Document<T> & T
}

/**
 * Collection is a store of entities defined by a single schema.
 */
export class Collection<T extends Entity = any> {
  /**
   * Validator is a function for validating inputs against a given schema.
   */
  readonly validator: ValidateFunction
  /**
   * Child is the underlying datastore.
   */
  readonly child: JsonPatchStore<T>
  /**
   * Emitter is the underlying event emitter for subscribing to collection events.
   */
  readonly emitter: EventEmitter<Events<T>> = new EventEmitter()

  /**
   * Collection creates a new collection.
   * @param name A name for the collection.
   * @param schema A valid JSON schema object.
   * @param options The underlying collection options.
   */
  constructor(readonly name: string, schema: JSONSchema, options: Options<T> = defaultOptions) {
    this.validator = new Ajv().compile(schema)
    this.child = new JsonPatchStore(options.child, new Key(name), options.dispatcher)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const c = this
    // Hacky function that gives us a nice ux for creating entities.
    const self = function Doc(entity: T) {
      if (!entity.ID) entity.ID = uuid()
      if (!c.validator(entity) && c.validator.errors) {
        throw new ValidationError(c.validator.errors)
      }
      return new Document(c, entity) as Document<T> & T
    }
    Object.setPrototypeOf(self, this.constructor.prototype)
    Object.getOwnPropertyNames(this).forEach(p => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      Object.defineProperty(self, p, Object.getOwnPropertyDescriptor(this, p)!)
    })
    return self as Collection<T>
  }

  /**
   * Find an entity by ID
   * @param id The entity id.
   */
  async findById(id: string) {
    return this.child.get(new Key(id))
  }

  /**
   * Find all entities matching the query
   * @param query Mongodb-style filter query.
   */
  find(query: FilterQuery<T>, options: FindOptions<T> = {}) {
    // @todo: Ideally, we'd use more mingo features here, but they don't support async iterators
    const m = new mingo.Query(query || {})
    const filters: Query.Filter<T>[] = [({ value }) => m.test(value)]
    const orders: Query.Order<T>[] = []
    if (options.sort) {
      for (const [key, value] of Object.entries(options.sort)) {
        orders.push(items =>
          items.sort((a, b) => {
            return cmp(dot(a.value, key), dot(b.value, key), value || 1)
          }),
        )
      }
    }
    const q: Query<T> = {
      ...options,
      filters,
      orders,
    }
    return this.child.query(q)
  }

  /**
   * Find the first entity matching the query
   * @param query Mongodb-style filter query.
   */
  findOne(query: FilterQuery<T>, options: FindOptions<T> = {}) {
    const it = this.find(query, options)
    return it[Symbol.asyncIterator]().next()
  }

  /**
   * Count all entities matching the query
   * @param query Mongodb-style filter query.
   */
  count(query: FilterQuery<T>, options: FindOptions<T> = {}) {
    return reduce((acc, _value) => acc + 1, 0, this.find(query, options))
  }

  /**
   * Save (multiple) entities.
   * @note Save is similar to insert, except it allows saving/overwriting existing entities.
   * @param entities A variadic array of entities.
   */
  save(...entities: T[]) {
    const batch = this.child.batch()
    for (const entity of entities) {
      if (!entity.ID) entity.ID = uuid()
      if (!this.validator(entity) && this.validator.errors) {
        throw new ValidationError(this.validator.errors)
      }
      batch.put(new Key(entity.ID), entity)
    }
    return batch.commit()
  }

  /**
   * Remove entities by id.
   * @param ids
   */
  delete(...ids: string[]) {
    const batch = this.child.batch()
    for (const id of ids) {
      batch.delete(new Key(id))
    }
    return batch.commit()
  }

  /**
   * Insert (multiple) new entities.
   * @note Insert is similar to save, except it will not allow saving/overwriting existing entities.
   * @param entities
   */
  async insert(...entities: T[]) {
    // By convention we'll use insert here, but could use a specific key instead
    const lockKey = new Key('insert')
    await this.child.readLock(lockKey)
    try {
      const batch = this.child.batch()
      for (const entity of entities) {
        if (!entity.ID) entity.ID = uuid()
        const key = new Key(entity.ID)
        if (await this.child.has(key)) {
          throw existingKeyError
        }
        if (!this.validator(entity) && this.validator.errors) {
          throw new ValidationError(this.validator.errors)
        }
        batch.put(key, entity)
      }
      return await batch.commit()
    } finally {
      this.child.unlock(lockKey)
    }
  }
}
