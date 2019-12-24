/* eslint-disable @typescript-eslint/no-var-requires */
import jsonpatch, { Operation } from 'fast-json-patch'
import { pack } from 'lexicographic-integer'
import log from 'loglevel'
// eslint-disable-next-line import/no-cycle
import { EventCodec, EncodedEvents } from '.'
import { EntityID } from '..'
import { Action, Entity, Event, Block } from '..'

// @todo: Find or write types for this
const Encoder = require('@ipld/block')

const logger = log.getLogger('store:codecs')

export { Operation }

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
  entityID: EntityID
  patch?: Operation[] | Entity
}

// PathEvent
export interface Patch extends Event {
  time: Buffer
  entityID: EntityID
  collection: string
  patch: Op
}

// RecordEvents
export interface Events {
  patches: Patch[]
}

export const Codec: EventCodec = {
  async encode<T extends Entity = object>(actions: Array<Action<T>>): Promise<EncodedEvents> {
    const events: Patch[] = actions.map(action => {
      let op: Op
      switch (action.type) {
        case Action.Type.Create:
          op = {
            type: Op.Type.Create,
            entityID: action.entityID,
            patch: action.current,
          }
          break
        case Action.Type.Save:
          op = {
            type: Op.Type.Save,
            entityID: action.entityID,
            patch: jsonpatch.compare(action.previous || {}, action.current || {}),
          }
          break
        case Action.Type.Delete:
          op = {
            type: Op.Type.Delete,
            entityID: action.entityID,
            patch: undefined,
          }
          break
        default:
          logger.error(`throwing error: Unknown Action`)
          throw new Error('Unkown Action')
      }
      return {
        // Patch
        time: Buffer.from(pack(Date.now())),
        entityID: action.entityID,
        collection: action.collection,
        patch: op,
      }
    })
    logger.debug(`processed events: ${events.length}`)
    const revents: Events = { patches: events }
    const encoder = Encoder.encoder(revents, 'dag-cbor', 'sha2-256')
    const block: Block = { cid: await encoder.cid(), data: encoder.encode() }
    logger.debug(`encoded block with cid: ${block.cid}`)
    return { events, block }
  },

  async decode<T extends Entity = object>(block: Block): Promise<Array<Event>> {
    const events: Events = Encoder.decoder(block.data, 'dag-cbor', 'sha2-256').decode()
    logger.debug(`decoded block with cid: ${block.cid}`)
    return events.patches
  },
}
