import { Datastore } from 'interface-datastore'
import { Entity, Action } from '..'

// eslint-disable-next-line import/no-cycle
export { ReadBatch, WriteBatch, Collection, CollectionKey } from './collection'
export { FilterQuery } from './query'

export interface ActionHandler<T extends Entity = object> {
  (actions: Array<Action<T>>): Promise<void>
}
