import * as uuid from 'uuid'

const WebSocket = require('isomorphic-ws')
const pack = require('../package.json')

interface Response {
  id: string
  status: 'ok' | 'error'
  body?: string
  error?: string
}

export class Client {

  public static version(): string {
    return pack.version
  }

  private socket: WebSocket | undefined
  private requests: Record<string, (res: Response) => void> = {}

  public async connect(url: string) {
    return new Promise((resolve) => {
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

  public async subscribe(...threads: string[]) {
    return this.send('subscribe', threads)
  }

  protected async send(method: string, args: string[]) {
    return new Promise((resolve, reject) => {
      if (this.socket === undefined) {
        reject('Connection required.')
        return
      }

      const id = uuid.v4()

      this.requests[id] = (res: Response) => {
        console.debug('Response: ', res)
        if (res.error !== undefined) {
          reject(new Error(res.error))
        } else if (res.body !== undefined) {
          resolve(JSON.parse(res.body))
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
    const res = JSON.parse(event.data)
    if (this.requests[res.id] !== undefined) {
      this.requests[res.id](res)
      delete this.requests[res.id]
    }
  }
}

export default new Client()
