import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'

import { endpoints } from '@/api/endpoints'
import { env } from '@/config/env'
import { operationResponseSchema, type Operation } from '@/schemas/operation.schema'
import {
  WIDGET_SIZE_NAMES,
  componentSchema,
  type GeneratedComponent,
} from '@/schemas/component.schema'

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
 * `EventSource` reconecta solo cuando el servidor corta. Lo que NO queremos es
 * reconectar porque el componente de React se volvió a pintar: por eso el
 * callback vive en un ref y el efecto sólo depende del id.
 */

export type OperationEventName =
  | 'component-created'
  | 'component-updated'
  | 'component-pending'
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
  const handler = useRef(onEvent)
  handler.current = onEvent
  const [status, setStatus] = useState<StreamStatus>('connecting')

  useEffect(() => {
    // Con id vacío quedaría una conexión colgada contra una ruta que da 404.
    if (!operationId) return

    setStatus('connecting')
    const url = `${env.VITE_API_URL}${endpoints.ai.events(operationId)}`
    const source = new EventSource(url)
    let ended = false

    source.addEventListener('open', () => setStatus('live'))
    // El navegador reconecta solo; esto sólo reporta el hueco.
    source.addEventListener('error', () => {
      if (!ended) setStatus('offline')
    })

    const listen = (name: OperationEventName) => {
      const listener = (event: MessageEvent<string>) => {
        const parsed = parsePayload(name, event.data)
        handler.current(name, parsed)
        if (name === 'simulation-completed') {
          // El servidor cierra el stream después de esto. Cerrar acá también
          // evita que `EventSource` reconecte a un feed que ya no trae nada.
          ended = true
          setStatus('ended')
          source.close()
        }
      }
      source.addEventListener(name, listener)
      return () => source.removeEventListener(name, listener)
    }

    const stop = [
      listen('component-created'),
      listen('component-updated'),
      listen('component-pending'),
      listen('operation-updated'),
      listen('simulation-completed'),
    ]

    return () => {
      for (const off of stop) off()
      source.close()
      setStatus('connecting')
    }
  }, [operationId])

  return status
}

function parsePayload(
  name: OperationEventName,
  data: string,
): GeneratedComponent | ComponentPendingEvent | Operation | null {
  // Un evento ilegible no tumba el stream: el consumidor refresca por HTTP.
  try {
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
