import { useEffect, useRef } from 'react'
import { z } from 'zod'

import { endpoints } from '@/api/endpoints'
import { env } from '@/config/env'
import {
  WIDGET_SIZE_NAMES,
  componentSchema,
  type GeneratedComponent,
} from '@/schemas/component.schema'

/**
 * EL CANAL DEL AGENTE — `GET /api/operations/:id/events`
 *
 * El backend abre un `text/event-stream` y publica tres eventos con nombre:
 * `component-pending` (antes de saber qué construirá el agente, con un
 * tamaño estimado), y `component-created`/`component-updated`, cada uno con
 * el componente ya serializado en `data`.
 *
 * Ojo con el alcance: este canal habla de LOS COMPONENTES de UNA operación.
 * No dice nada de la lista de operaciones, así que no reemplaza el sondeo de
 * la grilla ni el del riel — sirve para que la superficie generada se
 * reordene sola mientras la mirás, que es justo lo que pide el reto.
 *
 * `EventSource` reconecta solo cuando el servidor corta. Lo que NO queremos es
 * reconectar porque el componente de React se volvió a pintar: por eso el
 * callback vive en un ref y el efecto sólo depende del id.
 */

export type OperationEventName = 'component-created' | 'component-updated' | 'component-pending'

const componentPendingSchema = z.object({
  operationId: z.string(),
  tempId: z.string(),
  estimatedSize: z.enum(WIDGET_SIZE_NAMES),
})

export type ComponentPendingEvent = z.infer<typeof componentPendingSchema>

export type OperationEventHandler = (
  event: OperationEventName,
  payload: GeneratedComponent | ComponentPendingEvent | null,
) => void

export function useOperationEvents(operationId: string, onEvent: OperationEventHandler): void {
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    // Sin operación abierta no hay nada que escuchar. Abrir el stream con un
    // id vacío deja una conexión colgada contra una ruta que da 404.
    if (!operationId) return

    const url = `${env.VITE_API_URL}${endpoints.ai.events(operationId)}`
    const source = new EventSource(url)

    const listen = (name: OperationEventName) => {
      const listener = (event: MessageEvent<string>) => {
        // El componente es un extra: si el backend cambia la forma, el aviso de
        // "algo se movió" tiene que llegar igual para poder refrescar.
        const parsed =
          name === 'component-pending' ? safeParsePending(event.data) : safeParse(event.data)
        handler.current(name, parsed)
      }
      source.addEventListener(name, listener)
      return () => source.removeEventListener(name, listener)
    }

    const stop = [
      listen('component-created'),
      listen('component-updated'),
      listen('component-pending'),
    ]

    return () => {
      for (const off of stop) off()
      source.close()
    }
  }, [operationId])
}

function safeParse(data: string): GeneratedComponent | null {
  try {
    return componentSchema.parse(JSON.parse(data))
  } catch {
    // Un evento ilegible no puede tumbar el stream: el consumidor refresca por
    // HTTP y se entera igual.
    return null
  }
}

function safeParsePending(data: string): ComponentPendingEvent | null {
  try {
    return componentPendingSchema.parse(JSON.parse(data))
  } catch {
    return null
  }
}
