import { Service } from '@textile/threads-service'
import { ThreadID, ThreadRecord } from '@textile/threads-core'
import retry, { Options } from 'async-retry'
import merge from 'deepmerge'
import log from 'loglevel'
import { EventEmitter } from 'tsee'
import { Queue } from './queue'

const logger = log.getLogger('store:eventbus')

const retryOpts: Options = {
  retries: 5,
  onRetry: err => logger.warn(`create record failed (${err.message}), retrying...`),
}

export type Events = {
  [event in string | symbol]: (rec: ThreadRecord) => void
}

export type EventJob<T> = { id: ThreadID; body: T }

export class EventBus<T = any> extends EventEmitter<Events> {
  started = false
  constructor(public queue: Queue<EventJob<T>>, public service: Service, opts: Options = {}) {
    super()
    this.queue.on('next', async ({ job }) => {
      const { id, body } = job
      try {
        await retry(async (_bail, _num) => {
          // @todo: We could use bail here to bail if the service errors out with a headers closed error
          // This would mean that the gRPC service isn't running, i.e., we are in 'offline' mode
          await this.service.createRecord(id, body)
          return this.queue.done()
        }, merge(retryOpts, opts))
      } catch (err) {
        // Skip it for now, we've already tried 5 times!
        this.queue.done(true)
      }
    })
  }

  serviceWatcher(start = true) {
    this.service.subscribe(async rec => {
      if (rec) this.emit(rec.threadID.string(), rec)
    })
  }

  async start() {
    this.started = true
    await this.queue.open()
    this.serviceWatcher()
    return this.queue.start()
  }

  async stop() {
    this.started = false
    this.serviceWatcher(false)
    this.queue.stop()
    await this.queue.close()
  }

  /**
   * Push an event onto to the queue
   * @param job Object to be serialized and pushed to queue via JSON.stringify().
   */
  push(event: EventJob<T>) {
    this.queue.push(event)
  }
}
