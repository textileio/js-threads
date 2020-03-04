import { Result, Key } from 'interface-datastore'
import jsonpatch, { Operation } from 'fast-json-patch'
import { Store, ActionBatch, Event } from './store'

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

/**
 * Patch is a custom Event based on a JSON Patch.
 */
export interface Patch<T extends Entity> {
  patch: Op<T>
}

export interface Patches<T extends Entity> {
  patches: (Patch<T> & Event<T>)[]
}

export class JsonPatchStore<T extends Entity> extends Store<T, Patch<T>> {
  async reduce(...events: Result<Patch<T>>[]): Promise<void> {
    const batch = this.child.batch()
    for (const { key, value } of events) {
      if (!key.isDecendantOf(this.prefix)) continue // Only want to apply updates from this store
      const update = value.patch.patch
      if (update !== undefined) {
        const prev = await this.safeGet(key)
        const merged =
          prev === undefined ? (update as T) : jsonpatch.applyPatch(prev, update as Operation[]).newDocument
        batch.put(key, merged)
      } else {
        batch.delete(key)
      }
    }
    return await batch.commit()
  }

  batch(): ActionBatch<T> {
    return new ActionBatch(
      this,
      async key => {
        return {
          patch: {
            type: Op.Type.Delete,
            entityID: key.toString(),
            patch: undefined,
          },
        }
      },
      async (key: Key, value: T) => {
        const entityID = key.toString()
        let patch: Op<T>
        const old = await this.safeGet(key)
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
            patch: jsonpatch.compare(old, value),
          }
        }
        return { patch }
      },
    )
  }
}
