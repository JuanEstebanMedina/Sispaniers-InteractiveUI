import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { endpoints, queryKeys } from '@/api/endpoints'
import { env } from '@/config/env'
import { operationResponseSchema } from '@/schemas'

export type StreamStatus = 'connecting' | 'live' | 'offline' | 'ended'

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
 */
export function useComponentStream(operationId: string, cols: number): StreamStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StreamStatus>('connecting')

  useEffect(() => {
    if (!operationId) return

    const base = env.VITE_API_URL.replace(/\/$/, '')
    const source = new EventSource(`${base}${endpoints.ai.events(operationId)}`)
    let ended = false

    source.addEventListener('open', () => setStatus('live'))

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

    source.addEventListener('component-created', refetchComponents)
    source.addEventListener('component-updated', refetchComponents)

    source.addEventListener('operation-updated', (event) => {
      // The operation arrives whole, so this one goes straight into the cache:
      // no layout to repack, and the header updating a beat before the grid is
      // exactly the "the agent is working" signal the screen is meant to give.
      const parsed = operationResponseSchema.safeParse(
        JSON.parse((event as MessageEvent).data),
      )
      if (!parsed.success) return

      queryClient.setQueryData(queryKeys.operations.detail(operationId), parsed.data)
      // The rail sorts by health and recency, so the other operations have to
      // hear about it too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.list() })
    })

    source.addEventListener('simulation-completed', () => {
      // The server closes the stream after this. Closing from here as well
      // stops EventSource from reconnecting to a feed that has nothing left.
      ended = true
      setStatus('ended')
      source.close()
    })

    // The browser reconnects on its own; this only reports the gap, so stale
    // content is never shown as though it were live.
    source.addEventListener('error', () => {
      if (!ended) setStatus('offline')
    })

    return () => {
      source.close()
      setStatus('connecting')
    }
  }, [operationId, cols, queryClient])

  return status
}
