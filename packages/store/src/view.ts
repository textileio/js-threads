import { Result, Key, Datastore } from 'interface-datastore'
import { RWLock } from 'async-rwlock'
import { Reducer, Dispatcher } from './dispatcher'
import { ValuetransformDatastore } from './datastores/transform'

abstract class Test implements Datastore {}

// Views are essentially CQRS-style views of an event source. They can be materialized (persisted) or in-memory.
// Views can be built from an existing source of events (batched), and/or updated via a reducer method (single).
// Views are entirely generic, and can be used to build more complex datastores, such as:
// - Last Write Wins Key/Value Store
// - Multi-value Register Key/Value Store
// - JSON CRDT Document Store
// - JSON Patch Document Store

// export class View<M = any, V = Buffer, C = M> extends RWLock implements Reducer<C> {
//   constructor(public store: ValuetransformDatastore<M, V>) {
//     super()
//   }

//   static async fromEvents<M = any, V = Buffer, C = M>(source: Dispatcher<C>, sink: ValuetransformDatastore<M, V>) {
//     const view = new View(sink)
//     await view.writeLock()
//     try {
//       const batch = view.store.batch()
//       for await (const { key, value } of source.replay()) {
//         const keyed = new Key(key.type())
//         let prev: M | undefined
//         try {
//           prev = await view.store.get(keyed)
//         } catch (err) {
//           if (!err.toString().includes('Not found')) {
//             throw new Error(err)
//           }
//         }
//         const state = view.store.codec.reduce(prev, value)
//         batch.put(keyed, state)
//       }
//       await batch.commit()
//       return view
//     } finally {
//       view.unlock()
//     }
//   }

//   async reduce(...events: Result<C>[]): Promise<void> {
//     return this.withLock(async (self: View<M, V, C>) => {
//       const batch = self.store.batch()
//       for (const { key, value } of events) {
//         let prev: M | undefined
//         try {
//           prev = await self.store.get(key)
//         } catch (err) {
//           if (!err.toString().includes('Not found')) {
//             throw new Error(err)
//           }
//         }
//         const state = self.store.codec.reduce(prev, value)
//         batch.put(key, state)
//       }
//       return await batch.commit()
//     })
//   }
// }
