import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { endpoints, queryKeys } from '@/api/endpoints'
import { useSse } from '@/hooks'
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
 * `fetch` carries the normal Bearer token; native `EventSource` cannot.
 */
export function useComponentStream(operationId: string, cols: number): StreamStatus {
  const queryClient = useQueryClient()

  const onEvent = useCallback(
    (event: string, data: string) => {
      if (event === 'component-created' || event === 'component-updated') {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.components(operationId, cols),
      })
        return
      }

      if (event === 'operation-updated') {
      // The operation arrives whole, so this one goes straight into the cache:
      // no layout to repack, and the header updating a beat before the grid is
      // exactly the "the agent is working" signal the screen is meant to give.
      const parsed = operationResponseSchema.safeParse(
          JSON.parse(data),
      )
      if (!parsed.success) return

      queryClient.setQueryData(queryKeys.operations.detail(operationId), parsed.data)
      // The rail sorts by health and recency, so the other operations have to
      // hear about it too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.list() })
      }
    },
    [cols, operationId, queryClient],
  )

  return useSse(operationId ? endpoints.ai.events(operationId) : '', onEvent)
}
