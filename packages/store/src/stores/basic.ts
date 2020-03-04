import { Result, MemoryDatastore, Key } from 'interface-datastore'
import { Dispatcher } from '../dispatcher'
import { Store, ActionBatch, Event } from './store'

export class BasicStore extends Store {
  async reduce(...events: Result<Event<any>>[]) {
    const batch = this.child.batch()
    for (const { key, value } of events) {
      if (!key.isDecendantOf(this.prefix)) continue // Only want to apply updates from this store
      if (value === undefined) {
        batch.delete(key)
      } else {
        batch.put(key, value)
      }
    }
    await batch.commit()
    this.emit('update', ...events.map(event => event.value))
  }

  batch(): ActionBatch<any> {
    return new ActionBatch(
      this,
      async _key => undefined,
      async (_key, value) => value,
    )
  }
}

const store = new BasicStore(new MemoryDatastore(), new Key('blah'), new Dispatcher())
store.on('events', console.log)
store.put(new Key('bar'), 'hello world').then(console.log)
