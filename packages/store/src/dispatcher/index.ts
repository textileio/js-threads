import { Event } from '..'
/**
 * Reducer applies an event to an existing state.
 */
export interface Reducer {
  reduce(...events: Event[]): Promise<void>
}

export interface Interface {
  register(reducer: Reducer): Promise<void>
  dispatch(...events: Event[]): Promise<void>
}

// eslint-disable-next-line import/no-cycle
export { Dispatcher } from './dispatcher'
