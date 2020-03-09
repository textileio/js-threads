import { Datastore, Result, Key, Query, Batch, MemoryDatastore } from 'interface-datastore'
import { EventEmitter } from 'tsee'
import Ajv, { ValidateFunction, ValidationError } from 'ajv'
import uuid from 'uuid'
import { reduce } from 'streaming-iterables'
import mingo from 'mingo'
import toJsonSchema, { JSONSchema3or4 as JSONSchema } from 'to-json-schema'
import { Dispatcher, JsonPatchStore, Entity } from '@textile/threads-store'
import { FilterQuery } from './query'

/**
 * Events for a collection's EventEmitter
 */
type Events<T> = {
  // open: () => void
  // close: () => void
  // events: (...events: Event<T>[]) => void
  // update: (...updates: Update[]) => void
  // error: (err: Error) => void
}

/**
 * Options for creating a new collection.
 */
interface Options<T extends Entity> {
  child: Datastore<T>
  dispatcher: Dispatcher
  [key: string]: any
}

const defaultOptions: Options<any> = {
  child: new MemoryDatastore(),
  dispatcher: new Dispatcher(),
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
    set: (_target: T, property: keyof T, value: any, _receiver: any) => {
      return Reflect.set(obj, property, value)
    },
  }
}

export class Document<T extends Entity> {
  constructor(private _collection: Collection<T>, private _data: T) {}
  save() {
    if (!this._collection.validator(this._data) && this._collection.validator.errors) {
      throw new ValidationError(this._collection.validator.errors)
    }
    console.log(this._data)
    return this._collection.save(this._data)
  }
}

// Collections

export interface Collection<T extends Entity> {
  // @todo: Figure out how to have Document automatically have the same properties as T
  <T extends Entity>(data: T): Document<T> & T
  new <T extends Entity>(data: T): Document<T> & T
}

/**
 * Collection is a store of entities defined by a single schema.
 */
export class Collection<T extends Entity> extends EventEmitter<Events<T>> {
  readonly validator: ValidateFunction
  readonly child: JsonPatchStore<T>
  constructor(readonly name: string, schema: JSONSchema, options: Options<T> = defaultOptions) {
    super()
    this.validator = new Ajv().compile(schema)
    this.child = new JsonPatchStore(options.child, new Key(name), options.dispatcher)
    const self = (entity: T): Document<T> & T => {
      if (!entity.ID) entity.ID = uuid()
      if (!this.validator(entity) && this.validator.errors) {
        throw new ValidationError(this.validator.errors)
      }
      const doc = new Document(this, entity)
      return new Proxy(doc as any, handler(entity)) as Document<T> & T
    }
    Object.setPrototypeOf(self, this.constructor.prototype)
    return self as Collection<T>
  }

  /**
   * fromSchema creates a new empty store from an input JSON schema.
   * @param name A name for the collection.
   * @param schema A valid JSON schema object.
   * @param options The underlying store options.
   */
  static fromSchema<T extends Entity>(name: string, schema: JSONSchema, options: Options<T> = defaultOptions) {
    return new Collection<T>(name, schema, options)
  }

  /**
   * fromObject creates a new store from a representative input object.
   * It will attempt to infer the JSON schema from the input object.
   * @param name A name for the collection.
   * @param data A valid JSON object.
   * @param options The underlying store options.
   */
  static fromObject<T extends Entity>(name: string, obj: T, options: Options<T> = defaultOptions) {
    const schema = toJsonSchema(obj) as JSONSchema
    return this.fromSchema(name, schema, options)
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
  find(query: FilterQuery<T>) {
    const m = new mingo.Query(query || {})
    const f: Query.Filter<T> = ({ value }) => m.test(value)
    const q: Query<T> = {
      filters: [f],
    }
    return this.child.query(q)
  }

  /**
   * Find the first entity matching the query
   * @param query Mongodb-style filter query.
   */
  findOne(query: FilterQuery<T>) {
    const it = this.find(query)
    return it[Symbol.asyncIterator]().next()
  }

  /**
   * Count all entities matching the query
   * @param query Mongodb-style filter query.
   */
  count(query: FilterQuery<T>) {
    // @todo: See https://github.com/Ivshti/linvodb3/blob/master/lib/cursor.js
    return reduce((acc, _value) => acc + 1, 0, this.find(query))
  }

  /**
   * Save (multiple) entities.
   * @param entities A variadic array of entities.
   */
  save(...entities: T[]) {
    const batch = this.child.batch()
    for (const entity of entities) {
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
}
