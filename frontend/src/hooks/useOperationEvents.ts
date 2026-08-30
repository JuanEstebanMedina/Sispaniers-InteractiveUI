import { useEffect, useRef } from 'react'

import { endpoints } from '@/api/endpoints'
import { env } from '@/config/env'
import { componentSchema, type GeneratedComponent } from '@/schemas/component.schema'

/**
 * `GET /api/operations/:id/events` — los componentes de UNA operación. No habla
 * de la lista, así que no reemplaza el sondeo de la grilla ni del riel.
 *
 * El callback vive en un ref para no reconectar el stream en cada repintado.
 */

export type OperationEventName = 'component-created' | 'component-updated'

export type OperationEventHandler = (
  event: OperationEventName,
  component: GeneratedComponent | null,
) => void

export function useOperationEvents(operationId: string, onEvent: OperationEventHandler): void {
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    // Con id vacío quedaría una conexión colgada contra una ruta que da 404.
    if (!operationId) return

    const url = `${env.VITE_API_URL}${endpoints.ai.events(operationId)}`
    const source = new EventSource(url)

    const listen = (name: OperationEventName) => {
      const listener = (event: MessageEvent<string>) => {
        // Si la forma cambia, el aviso debe llegar igual para poder refrescar.
        const parsed = safeParse(event.data)
        handler.current(name, parsed)
      }
      source.addEventListener(name, listener)
      return () => source.removeEventListener(name, listener)
    }

    const stop = [listen('component-created'), listen('component-updated')]

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
    // Un evento ilegible no tumba el stream: el consumidor refresca por HTTP.
    return null
  }
}
