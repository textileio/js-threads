import * as uuid from 'uuid'

const WebSocket = require('isomorphic-ws')
const pack = require('../package.json')

interface Message {
  id?: string
  type?: string
  status?: 'ok' | 'error'
  body?: string
  error?: string
}

export interface LogRecord {
  id: string
  log_id?: string
  thread_id: string
  record_node?: string
  event_node?: string
  header_node?: string
  body_node?: string
}

interface Subscription {
  threads: string[]
  handler: (rec: LogRecord) => void
}

export class Client {

  public static version(): string {
    return pack.version
  }

  private socket: WebSocket | undefined
  private requests: Record<string, (res: Message) => void> = {}
  private subscriptions: Record<string, Subscription> = {}

  public async connect(url: string) {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(url) as WebSocket

      this.socket.onopen = () => {
        console.debug('Connection opened.')
        resolve()
      }
      this.socket.onclose = () => {
        console.debug('Connection closed.')
      }
      this.socket.onerror = (e) => {
        console.error(e)
        reject(e)
      }
      this.socket.onmessage = (e) => {
        this.handleEvent(e)
      }
    })
  }

  public async addThread(addr: string, followKey: string, readKey: string) {
    return this.send('addThread', [addr, followKey, readKey])
  }

  public async pullThread(id: string) {
    return this.send('pullThread', [id])
  }

  public async deleteThread(id: string) {
    return this.send('deleteThread', [id])
  }

  public async addFollower(addr: string) {
    return this.send('addFollower', [addr])
  }

  public async addRecord(body: any, threadID: string) {
    return this.send('addRecord', [JSON.stringify(body), threadID])
  }

  public async getRecord(recordID: string, threadID: string) {
    return this.send('getRecord', [threadID, recordID])
  }

  public async subscribe(threads: string[], handler: (rec: LogRecord) => void) {
    return this.send('subscribe', threads).then(() => {
      const token = uuid.v4()
      this.subscriptions[token] = {
        threads,
        handler
      }
      return token
    })
  }

  protected async send(method: string, args: string[]) {
    return new Promise((resolve, reject) => {
      if (this.socket === undefined) {
        reject('Connection required.')
        return
      }

      const id = uuid.v4()
      this.requests[id] = (res: Message) => {
        if (res.error) {
          reject(new Error(res.error))
        } else if (res.body) {
          resolve(JSON.parse(res.body) as LogRecord)
        } else {
          resolve()
        }
      }

      this.socket.send(JSON.stringify({
        id,
        method,
        args
      }))
    })
  }

  private handleEvent(event: MessageEvent) {
    const res = JSON.parse(event.data) as Message

    switch (res.type) {
      case 'newRecord':
        if (res.body === undefined) {
          console.error('missing message body')
          return
        }
        const body = JSON.parse(res.body) as LogRecord
        Object.keys(this.subscriptions).forEach((token) => {
          const sub = this.subscriptions[token]
          sub.threads.forEach((id) => {
            if (id === body.thread_id) {
              sub.handler(body)
            }
          })
        })
        break
      case 'response':
        if (res.id && this.requests[res.id]) {
          this.requests[res.id](res)
          delete this.requests[res.id]
        }
        break
      default:
        console.error(new Error('unknown message type: ' + res.type))
    }
  }
}

export default new Client()
