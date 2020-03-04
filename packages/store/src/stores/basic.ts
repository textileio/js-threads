import { Result, Datastore, Key } from 'interface-datastore'
import { Dispatcher, Event } from '../dispatcher'
import { Store, ActionBatch } from './store'

export class BasicStore<T = any> extends Store<T> {
  constructor(child: Datastore<any>, prefix: Key, dispatcher?: Dispatcher | undefined) {
    super(child, prefix, dispatcher)
  }
  reduce = async (...events: Result<Event<T>>[]) => {
    const batch = this.child.batch()
    for (const { key, value } of events) {
      if (!key.isDecendantOf(this.prefix)) continue // Only want to apply updates from this store
      const newKey = new Key(value.id)
      if (value.patch === undefined) {
        batch.delete(newKey)
      } else {
        batch.put(newKey, value.patch)
      }
    }
    await batch.commit()
    this.emit('update', ...events.map(event => event.value))
  }

  batch(): ActionBatch<T> {
    return new ActionBatch<T>(
      this,
      async _key => undefined,
      async (_key, patch) => patch,
    )
  }
}
