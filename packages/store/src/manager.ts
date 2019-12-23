// import uuid from 'uuid/v4'
import { Store } from './store'

type UUID = string

export interface StoreManager {
  stores: Record<UUID, Store>
  create(): { id: UUID; store: Store }
  get(id: UUID): Store
  close(): void
}
