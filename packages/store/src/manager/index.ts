// import uuid from 'uuid/v4'
import { Store, StoreID } from '../store'

export interface Interface {
  // threadService: ThreadService
  stores: Map<StoreID, Store>
  newStore(): { id: StoreID; store: Store }
  get(id: StoreID): Store | undefined
  close(): Promise<void>
}
