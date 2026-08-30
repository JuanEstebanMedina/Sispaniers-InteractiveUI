import { useCallback } from 'react'
import { z } from 'zod'

import { endpoints } from '@/api/endpoints'
import { operationResponseSchema, type Operation } from '@/schemas/operation.schema'
import {
  WIDGET_SIZE_NAMES,
  componentSchema,
  type GeneratedComponent,
} from '@/schemas/component.schema'
import { useSse } from './useSse'

export type OperationEventName =
  | 'component-created'
  | 'component-updated'
  | 'component-pending'
  | 'component-pending-cleared'
  | 'operation-updated'
  | 'simulation-completed'

const componentPendingSchema = z.object({
  operationId: z.string(),
  tempId: z.string(),
  estimatedSize: z.enum(WIDGET_SIZE_NAMES),
})

export type ComponentPendingEvent = z.infer<typeof componentPendingSchema>

export type OperationEventHandler = (
  event: OperationEventName,
  payload: GeneratedComponent | ComponentPendingEvent | Operation | null,
) => void

export type StreamStatus = 'connecting' | 'live' | 'offline' | 'ended'

/**
 * EventSource cannot send an Authorization header. That works today because the
 * events route has no auth, and it is why this uses the browser's SSE client
 * rather than the axios instance — protect that route and this has to become
 * fetch with a ReadableStream.
 */
export function useOperationEvents(
  operationId: string,
  onEvent: OperationEventHandler,
): StreamStatus {
  const handleSseEvent = useCallback(
    (name: string, data: string) => {
      if (!isOperationEventName(name)) return
      onEvent(name, parsePayload(name, data))
    },
    [onEvent],
  )

  return useSse(operationId ? endpoints.ai.events(operationId) : '', handleSseEvent)
}

function isOperationEventName(value: string): value is OperationEventName {
  return (
    value === 'component-created' ||
    value === 'component-updated' ||
    value === 'component-pending' ||
    value === 'component-pending-cleared' ||
    value === 'operation-updated' ||
    value === 'simulation-completed'
  )
}

function parsePayload(
  name: OperationEventName,
  data: string,
): GeneratedComponent | ComponentPendingEvent | Operation | null {
  try {
    if (name === 'component-pending-cleared') return null
    const json = JSON.parse(data)
    if (name === 'component-pending') return componentPendingSchema.parse(json)
    if (name === 'operation-updated' || name === 'simulation-completed') {
      return operationResponseSchema.parse(json)
    }
    return componentSchema.parse(json)
  } catch (error) {
    console.error('[sse] failed to parse event payload', name, data, error)
    return null
  }
}
