import { Datastore, Result, Key } from 'interface-datastore'
import jsonpatch, { Operation } from 'fast-json-patch'
import { Dispatcher, Event } from '../dispatcher'
import { Store, ActionBatch } from './store'

/**
 * Entity is any object with an ID field.
 */
export interface Entity {
  ID: string
  [others: string]: any
}

/**
 * Op is a custom Store operation with a specific set of types.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Op {
  export enum Type {
    Create = 0,
    Save,
    Delete,
  }
}

export interface Op<T extends Entity> {
  type: Op.Type
  entityID: string
  patch?: Operation[] | T
}

export class JsonPatchStore<T extends Entity> extends Store<T, Op<T>> {
  constructor(child?: Datastore<any>, prefix?: Key, dispatcher?: Dispatcher) {
    super(child, prefix, dispatcher)
  }
  reduce = async (...events: Result<Event<Op<T>>>[]) => {
    const batch = this.child.batch()
    for (const { key, value } of events) {
      if (!key.isDecendantOf(this.prefix)) continue // Only want to apply updates from this store
      const newKey = new Key(value.id)
      const update = value.patch?.patch
      // If the patch or the patch itself is undefined, we delete
      if (update === undefined) {
        batch.delete(newKey)
      } else {
        const prev = await this.safeGet(newKey)
        const merged =
          prev === undefined ? (update as T) : jsonpatch.applyPatch(prev, update as Operation[]).newDocument
        batch.put(newKey, merged)
      }
    }
    await batch.commit()
    this.emit('update', ...events.map(event => event.value))
  }

  batch(): ActionBatch<T, Op<T>> {
    return new ActionBatch<T, Op<T>>(
      this,
      async key => ({
        type: Op.Type.Delete,
        entityID: key.toString().slice(1),
        patch: undefined,
      }),
      async (key: Key, value: T) => {
        const entityID = key.toString().slice(1)
        let patch: Op<T>
        const old = await this.safeGet(key)
        if (old === undefined) {
          patch = {
            type: Op.Type.Create,
            entityID,
            patch: value,
          }
        } else {
          const ops = jsonpatch.compare(old, value)
          patch = {
            type: Op.Type.Save,
            entityID,
            // If no ops, old == new
            patch: ops.length > 0 ? ops : old,
          }
        }
        return patch
      },
    )
  }
}
