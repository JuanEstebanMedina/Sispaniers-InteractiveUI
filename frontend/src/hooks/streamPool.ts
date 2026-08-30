/**
 * ONE CONNECTION PER OPERATION, HOWEVER MANY PARTS OF THE SCREEN WANT IT
 *
 * A browser allows six simultaneous HTTP/1.1 connections per origin, and a
 * server-sent event stream holds one open for as long as it lives. The events
 * route only ends a stream when the simulation finishes, so an operation that
 * is merely being looked at keeps its connection indefinitely.
 *
 * The rail and the detail page both want that same feed. Opening it twice
 * halved the budget: three operations were enough to spend all six, and every
 * request after that failed for want of a connection — including the ones that
 * fetch the widgets.
 *
 * So subscribers are counted rather than connections opened. The stream closes
 * when the last one leaves.
 */

import { endpoints } from '@/api/endpoints'
import { env } from '@/config/env'

export interface SharedStream {
  readyState: number
  addEventListener(name: string, listener: (event: MessageEvent<string>) => void): void
  removeEventListener(name: string, listener: (event: MessageEvent<string>) => void): void
  close(): void
}

export interface Lease {
  stream: SharedStream
  release(): void
}

export interface StreamPool {
  acquire(url: string): Lease
}

/**
 * The server ends the stream itself once a simulation is over, and a clean
 * close is indistinguishable to `EventSource` from a dropped one: it reconnects
 * on its own, forever, spending a connection on every attempt. Closing here is
 * what makes that stop, and it belongs to whoever owns the connection.
 */
const FINISHED = 'simulation-completed'

interface Entry {
  stream: SharedStream
  subscribers: number
}

export function createStreamPool(open: (url: string) => SharedStream): StreamPool {
  const shared = new Map<string, Entry>()

  const retire = (url: string, entry: Entry) => {
    // Only if it is still the current one: a later subscriber may already have
    // opened a replacement for this same operation.
    if (shared.get(url) === entry) shared.delete(url)
  }

  return {
    acquire(url) {
      let entry = shared.get(url)

      if (!entry) {
        const stream = open(url)
        entry = { stream, subscribers: 0 }
        shared.set(url, entry)

        const current = entry
        stream.addEventListener(FINISHED, () => {
          retire(url, current)
          stream.close()
        })
      }

      entry.subscribers += 1

      let released = false

      return {
        stream: entry.stream,
        release() {
          // A subscriber that unmounts twice must not take the connection from
          // whoever opened it in between.
          if (released) return
          released = true

          entry.subscribers -= 1
          if (entry.subscribers > 0) return

          retire(url, entry)
          entry.stream.close()
        },
      }
    },
  }
}

export const operationStreams = createStreamPool((url) => new EventSource(url))

/**
 * Both subscribers have to build the exact same string or the pool hands them
 * two connections instead of one, which is the whole failure this prevents.
 */
export function operationEventsUrl(operationId: string): string {
  return `${env.VITE_API_URL.replace(/\/$/, '')}${endpoints.ai.events(operationId)}`
}
