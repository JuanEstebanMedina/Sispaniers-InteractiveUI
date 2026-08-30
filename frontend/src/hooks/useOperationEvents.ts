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

/**
 * `GET /api/operations/:id/events` — todo lo que pasa en UNA operación: sus
 * componentes Y la operación misma. No habla de la lista, así que no
 * reemplaza el sondeo de la grilla ni del riel.
 *
 * El backend abre un `text/event-stream` y publica cinco eventos con nombre:
 * `component-pending` (antes de saber qué construirá el agente, con un
 * tamaño estimado), `component-created`/`component-updated` (el componente ya
 * serializado en `data`), y `operation-updated`/`simulation-completed` (la
 * operación completa, para que la cabecera se entere sin sondear).
 *
 * `useSse` usa fetch para poder enviar el JWT; `EventSource` no admite headers.
 */

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

/** Estado de la conexión, para que un contenido viejo nunca pase por en vivo. */
export type StreamStatus = 'connecting' | 'live' | 'offline' | 'ended'

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
  // Un evento ilegible no tumba el stream: el consumidor refresca por HTTP.
  try {
    if (name === 'component-pending-cleared') return null
    const json = JSON.parse(data)
    if (name === 'component-pending') return componentPendingSchema.parse(json)
    if (name === 'operation-updated' || name === 'simulation-completed') {
      return operationResponseSchema.parse(json)
    }
    return componentSchema.parse(json)
  } catch {
    return null
  }
}
