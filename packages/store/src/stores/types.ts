import { Operation } from 'fast-json-patch'

/**
 * Entity is any object with an ID field.
 */
export interface Entity {
  ID: string
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

export interface Op {
  type: Op.Type
  entityID: string
  patch?: Operation[] | Entity
}

/**
 * Event is a local or remote event.
 */
export interface Event {
  timestamp: Buffer
  id: string
  collection: string // model
}

/**
 * PatchEvent is a custom Event based on a JSON Patch.
 */
export interface PatchEvent extends Event {
  patch: Op
}

export interface Patches {
  patches: PatchEvent[]
}
