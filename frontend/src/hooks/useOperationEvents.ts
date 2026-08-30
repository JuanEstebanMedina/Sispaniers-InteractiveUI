import { useEffect, useRef } from 'react'

import { componentSchema, type GeneratedComponent } from '@/schemas/component.schema'
import { operationEventsUrl, operationStreams, type SharedStream } from './streamPool'

/**
 * `GET /api/operations/:id/events` — the components of ONE operation. It says
 * nothing about the list, so it replaces neither the grid's polling nor the
 * rail's.
 *
 * The connection is shared: see `streamPool`. This only adds its own listeners
 * and takes them away again, and never closes what it did not open.
 *
 * The callback lives in a ref so a repaint does not reconnect the stream.
 */

export type OperationEventName = 'component-created' | 'component-updated'

export type OperationEventHandler = (
  event: OperationEventName,
  component: GeneratedComponent | null,
) => void

const COMPONENT_EVENTS: readonly OperationEventName[] = ['component-created', 'component-updated']

export function bindOperationEvents(
  source: SharedStream,
  onEvent: OperationEventHandler,
): () => void {
  const stop: (() => void)[] = []

  for (const name of COMPONENT_EVENTS) {
    const listener = (event: MessageEvent<string>) => {
      // The component is a bonus: if the backend changes its shape, the news
      // that something moved still has to arrive so the screen can refresh.
      onEvent(name, safeParse(event.data))
    }

    source.addEventListener(name, listener)
    stop.push(() => source.removeEventListener(name, listener))
  }

  return () => {
    for (const off of stop) off()
    stop.length = 0
  }
}

export function useOperationEvents(operationId: string, onEvent: OperationEventHandler): void {
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    // An empty id would leave a connection hanging against a route that 404s.
    if (!operationId) return

    const lease = operationStreams.acquire(operationEventsUrl(operationId))
    const unbind = bindOperationEvents(lease.stream, (event, component) =>
      handler.current(event, component),
    )

    return () => {
      unbind()
      lease.release()
    }
  }, [operationId])
}

function safeParse(data: string): GeneratedComponent | null {
  try {
    return componentSchema.parse(JSON.parse(data))
  } catch {
    // An unreadable event does not bring the stream down: the consumer
    // refreshes over HTTP.
    return null
  }
}
