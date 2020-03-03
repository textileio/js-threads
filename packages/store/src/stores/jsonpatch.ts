import { Datastore, Result, Key, Query, Batch } from 'interface-datastore'
import Ajv, { ValidateFunction } from 'ajv'
import jsonpatch, { Operation } from 'fast-json-patch'
import uuid from 'uuid'
import mingo from 'mingo'
import lexInt from 'lexicographic-integer'
import toJsonSchema, { JSONSchema3or4 as JSONSchema } from 'to-json-schema'
import { Lockable } from '../datastores/abstract/lockable'
import { Comparer } from '../datastores/abstract/comparable'
import { EncodingDatastore, Encoder } from '../datastores/encoding'
import { DomainDatastore } from '../datastores/domain'
import { Dispatcher } from '../dispatcher'
import { FilterQuery } from './query'
import { Op, PatchEvent, Entity } from './types'

export const CollectionKey = new Key('collection')

export type Action<T> = () => Promise<T>

export type ActionPatchEvent = Action<PatchEvent>

const JsonEncoder: Encoder<any, Buffer> = {
  encode: (data: any) => Buffer.from(JSON.stringify(data)),
  decode: (stored: Buffer) => JSON.parse(stored.toString()),
}

/**
 * Comparer for creating JSON Patch operations.
 */
export const JsonComparer: Comparer<any, Operation[]> = {
  compare: (value: any, update: any) => jsonpatch.compare(value, update),
  combine: (value: any, delta: Operation[]) => jsonpatch.applyPatch(value, delta).newDocument,
}

export class JsonPatchBatch<T extends Entity> implements Batch<T> {
  private patches: ActionPatchEvent[] = []
  constructor(private store: JsonPatchStore<T>) {}
  delete(key: Key) {
    const deferred = async () => {
      const event: PatchEvent = {
        timestamp: Buffer.from(lexInt.pack(Date.now())),
        id: key.toString(),
        collection: this.store.prefix.toString(),
        patch: {
          type: Op.Type.Delete,
          entityID: key.toString(),
          patch: undefined,
        },
      }
      return event
    }
    this.patches.push(deferred)
  }

  put(key: Key, value: T) {
    const entityID = key.toString()
    const deferred = async () => {
      let patch: Op
      const old = await this.store.safeGet(key)
      if (old === undefined) {
        patch = {
          type: Op.Type.Create,
          entityID,
          patch: value,
        }
      } else {
        patch = {
          type: Op.Type.Save,
          entityID,
          patch: this.store.comparer.compare(old, value),
        }
      }
      const event: PatchEvent = {
        timestamp: Buffer.from(lexInt.pack(Date.now())),
        id: entityID,
        collection: this.store.prefix.toString(),
        patch,
      }
      return event
    }
    this.patches.push(deferred)
  }

  async commit() {
    if (this.patches.length > 0) {
      await this.store.dispatch(...this.patches)
    }
    return
  }
}

export class JsonPatchStore<T extends Entity> extends Lockable implements Datastore<T> {
  public child: Datastore<T>
  readonly comparer = JsonComparer
  constructor(
    child: Datastore<Buffer>,
    public prefix: Key,
    readonly validator: ValidateFunction,
    readonly dispatcher: Dispatcher,
  ) {
    super(prefix)
    this.child = new EncodingDatastore(new DomainDatastore(child, prefix), JsonEncoder)
  }

  /**
   * FromSchema creates a new empty store from an input JSON schema.
   * @param child The underlying datastore to wrap.
   * @param name A name for the store.
   * @param schema A valid JSONSchema object.
   */
  static fromSchema<T extends Entity>(child: Datastore, name: string, schema: JSONSchema, dispatcher: Dispatcher) {
    return new JsonPatchStore<T>(child, new Key(name), new Ajv().compile(schema), dispatcher)
  }

  /**
   * FromObject creates a new store from a representative input object.
   * It will attempt to infer the JSON schema from the input object.
   * @param child The underlying datastore to wrap.
   * @param name A name for the Collection.
   * @param data A valid JSON object.
   */
  static fromObject<T extends Entity>(child: Datastore, name: string, dispatcher: Dispatcher, obj: T) {
    const schema = toJsonSchema(obj) as JSONSchema
    return this.fromSchema(child, name, schema, dispatcher)
  }

  async safeGet(key: Key) {
    try {
      return this.child.get(key)
    } catch (err) {
      if (!err.toString().includes('Not found')) {
        throw new Error(err)
      }
    }
  }

  async reduce(...events: Result<PatchEvent>[]): Promise<void> {
    const batch = this.child.batch()
    for (const { key, value } of events) {
      if (!key.isDecendantOf(this.prefix)) continue // Only want to apply updates from this store
      const update = value.patch.patch
      if (update !== undefined) {
        const prev = await this.safeGet(key)
        const merged = prev === undefined ? (update as Entity) : this.comparer.combine(prev, update as Operation[])
        batch.put(key, merged)
      } else {
        batch.delete(key)
      }
    }
    return await batch.commit()
  }

  async dispatch(...actions: ActionPatchEvent[]) {
    const events = await Promise.all(
      actions.map(async event => {
        const value = await event()
        const key = new Key(value.id).child(new Key(value.collection)).child(new Key(value.timestamp.toString()))
        return { key, value }
      }),
    )
    return this.dispatcher.dispatch(...events)
  }

  open() {
    return this.child.open()
  }

  close() {
    return this.child.close()
  }

  has(key: Key) {
    return this.child.has(key)
  }

  get(key: Key) {
    return this.child.get(key)
  }

  // Find returns an async iterable of Entities that match the given criteria.
  query(query: Query<T>, filter?: FilterQuery<T>) {
    const q = new mingo.Query(filter || {})
    const f: Query.Filter<T> = ({ value }) => q.test(value)
    query.filters = [...(query.filters || []), f]
    return this.child.query(query)
  }

  batch() {
    return new JsonPatchBatch(this)
  }

  put(key: Key, value: T) {
    const batch = new JsonPatchBatch(this)
    batch.put(key, value)
    return batch.commit()
  }

  delete(key: Key) {
    const batch = new JsonPatchBatch(this)
    batch.delete(key)
    return batch.commit()
  }
}
