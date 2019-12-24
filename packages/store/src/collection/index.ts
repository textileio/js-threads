import { Datastore } from 'interface-datastore'
import { Entity, Action } from '..'

// eslint-disable-next-line import/no-cycle
export { ReadBatch, WriteBatch, Collection } from './collection'
export { FilterQuery } from './query'

export interface ActionHandler<T extends Entity = object> {
  (store: Datastore<any>, actions: Array<Action<T>>): Promise<void>
}
