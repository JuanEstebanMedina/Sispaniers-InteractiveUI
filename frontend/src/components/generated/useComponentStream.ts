import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { queryKeys } from '@/api/endpoints'
import { operationEventsUrl, operationStreams } from '@/hooks/streamPool'
import { operationResponseSchema } from '@/schemas'

export type StreamStatus = 'connecting' | 'live' | 'offline' | 'ended'

/** `EventSource.OPEN`, named so this does not depend on the global at import time. */
const OPEN = 1

/**
 * The live half of the generated UI: the agent writes, the grid restructures.
 *
 * `GET /operations/:id/events` streams four things:
 *
 *   component-created / component-updated   a widget appeared or changed
 *   operation-updated                       the shipment itself moved
 *   simulation-completed                    nothing more is coming
 *
 * `EventSource` cannot send an Authorization header. That works today because
 * the events route has no auth, and it is why this uses the browser's own SSE
 * client instead of the axios instance — the moment that route is protected,
 * this has to become fetch with a ReadableStream.
 *
 * The connection comes from `streamPool` and is shared with the rail, so this
 * adds listeners and takes them away: closing belongs to the pool.
 */
export function useComponentStream(operationId: string, cols: number): StreamStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StreamStatus>('connecting')

  useEffect(() => {
    if (!operationId) return

    const lease = operationStreams.acquire(operationEventsUrl(operationId))
    const source = lease.stream
    const stop: (() => void)[] = []
    let ended = false

    const listen = (name: string, listener: (event: MessageEvent<string>) => void) => {
      source.addEventListener(name, listener)
      stop.push(() => source.removeEventListener(name, listener))
    }

    // A connection the rail already opened will not fire `open` again, so a
    // late subscriber reads the state instead of waiting for an event that has
    // already been and gone.
    if (source.readyState === OPEN) setStatus('live')
    listen('open', () => setStatus('live'))

    /**
     * Refetch rather than splice the new component into the cache.
     *
     * The backend packs the layout for a given column count, and a widget with
     * no layout entry is dropped by `toWidgets`. Appending locally would put a
     * component in the cache that never reaches the screen — so the one thing
     * that must come from the server is exactly what a refetch brings back.
     */
    const refetchComponents = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.components(operationId, cols),
      })
    }

    listen('component-created', refetchComponents)
    listen('component-updated', refetchComponents)

    listen('operation-updated', (event) => {
      // The operation arrives whole, so this one goes straight into the cache:
      // no layout to repack, and the header updating a beat before the grid is
      // exactly the "the agent is working" signal the screen is meant to give.
      const parsed = operationResponseSchema.safeParse(JSON.parse(event.data))
      if (!parsed.success) return

      queryClient.setQueryData(queryKeys.operations.detail(operationId), parsed.data)
      // The rail sorts by health and recency, so the other operations have to
      // hear about it too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.list() })
    })

    listen('simulation-completed', () => {
      ended = true
      setStatus('ended')
    })

    // The browser reconnects on its own; this only reports the gap, so stale
    // content is never shown as though it were live.
    listen('error', () => {
      if (!ended) setStatus('offline')
    })

    return () => {
      for (const off of stop) off()
      lease.release()
      setStatus('connecting')
    }
  }, [operationId, cols, queryClient])

  return status
}
