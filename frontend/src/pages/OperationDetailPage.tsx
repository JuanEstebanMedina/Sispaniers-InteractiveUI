import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api, api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { SectionBoundary } from '@/components/feedback/ErrorBoundary'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ComponentDataProvider } from '@/components/generated/ComponentData'
import type { Widget } from '@/components/generated/WidgetGrid'
import { WidgetGrid } from '@/components/generated/WidgetGrid'
import { toWidgets } from '@/components/generated/toWidgets'
import { GeneratedSurface } from '@/components/operations/GeneratedSurface'
import { OperationDetailHeader } from '@/components/operations/OperationDetailHeader'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { useOperationEvents } from '@/hooks'
import type { ComponentPendingEvent, OperationEventName } from '@/hooks/useOperationEvents'
import { WIDGET_SIZES } from '@/lib/grid'
import {
  componentsResponseSchema,
  operationListSchema,
  operationResponseSchema,
  type Operation,
} from '@/schemas'
import { useRailStore } from '@/stores/railStore'

/**
 * DETALLE DE UNA OPERACIÓN
 *
 * El riel con las demás NO está acá: lo pone `OperationsLayout`, que es la
 * ruta padre. Por eso al saltar de una operación a otra el riel ni se entera.
 *
 * `SectionBoundary` va sólo alrededor de la superficie generada y no de la
 * página entera: si lo que escribe el agente revienta, la cabecera y el riel
 * tienen que seguir vivos para poder irse a otra operación.
 */

/** Lo que usa `WidgetGrid` mientras todavía no se ha medido. */
const DEFAULT_COLS = 4

export default function OperationDetailPage() {
  const { t } = useTranslation('domain')
  const { trackId } = useParams({ from: '/app/operations/$trackId' })

  const detail = useQuery({
    queryKey: queryKeys.operations.detail(trackId),
    queryFn: () => api$.get(endpoints.operations.detail(trackId), operationResponseSchema),
  })

  // El backend empaqueta la grilla para un número de columnas concreto, y quien
  // sabe cuántas caben es el grid, que se mide a sí mismo. Arranca en el mismo
  // valor que usa él antes de medir, y lo corrige en cuanto lo sabe.
  const [cols, setCols] = useState(DEFAULT_COLS)

  const components = useQuery({
    queryKey: queryKeys.operations.components(trackId, cols),
    queryFn: () =>
      api$.get(
        `${endpoints.operations.components(trackId)}?cols=${cols}`,
        componentsResponseSchema,
      ),
  })

  // Moves have to reach the backend in the order the user made them. Each one
  // renumbers the whole sequence, so a request that overtakes the one before it
  // renumbers from a position the user has already left — and the stored order
  // ends up matching neither drag. Chaining them here is what makes the order
  // on the wire the order on the screen.
  const inFlight = useRef<Promise<unknown>>(Promise.resolve())

  // Fire-and-forget on purpose: moving or renaming a widget must never block
  // the run or steal the screen with an error toast.
  const savePlacement = useMutation({
    mutationFn: ({ id, ...body }: { id: string; position?: number; title?: string }) => {
      const sent = inFlight.current.then(() =>
        api.patch(endpoints.operations.componentPlacement(trackId, id), body),
      )
      inFlight.current = sent.catch(() => undefined)
      return sent
    },
  })

  // Same key the layout and the grid use, so this is a cache read, not a fetch.
  const others = useQuery({
    queryKey: queryKeys.operations.list(),
    queryFn: () => api$.post(endpoints.operations.search, operationListSchema, {}),
  })
  // `needs_decision` no existe en el backend: el status se deriva del estado
  // de los contenedores y sólo puede ser uno de los cinco reales. Hasta que el
  // agente exponga sus pausas, "reclama atención" es la salud crítica.
  const waiting = (others.data?.operations ?? []).filter(
    (operation) => operation.trackId !== trackId && operation.health === 'critical',
  ).length

  const railOpen = useRailStore((state) => state.open)
  const railWidth = useRailStore((state) => state.width)

  const queryClient = useQueryClient()
  const operation = detail.data
  const generated = components.data

  // Un componente en camino tarda un round-trip completo a la IA en aparecer.
  // Mientras tanto se pinta un placeholder del tamaño estimado que llegó en
  // "component-pending"; se retira en cuanto llega el componente real, o solo
  // por seguridad si nunca llega.
  const [pending, setPending] = useState<ComponentPendingEvent[]>([])

  // ponytail: si la petición del chat falla, el backend nunca emite
  // component-created para reemplazar este placeholder. No hay un evento de
  // fallo dedicado ni una forma simple de enterarse desde este árbol de
  // componentes (el chat vive en el riel), así que el techo es un timeout: si
  // nadie lo reclamó en este plazo, se asume que la petición murió. Subir a un
  // evento "component-pending-failed" si este plazo resulta corto o largo en
  // la práctica.
  const PENDING_TIMEOUT_MS = 45_000

  const onOperationEvent = useCallback(
    (event: OperationEventName, payload: unknown) => {
      if (event === 'component-pending') {
        const pendingEvent = payload as ComponentPendingEvent | null
        if (!pendingEvent) return
        setPending((current) => [...current, pendingEvent])
        return
      }

      if (event === 'component-pending-cleared') {
        // The AI answered in plain text this turn — no component is coming,
        // so nothing will ever replace the oldest placeholder. Drop it now
        // instead of leaving it on screen until its timeout.
        setPending((current) => current.slice(1))
        return
      }

      if (event === 'component-created' || event === 'component-updated') {
        // El chat de la operación es de un solo mensaje en vuelo a la vez, así
        // que el placeholder más viejo es siempre el que este componente real
        // reemplaza.
        setPending((current) => current.slice(1))
        // El backend empaqueta la grilla para `cols`; anexar en el cliente
        // dejaría un componente en la cache que `toWidgets` nunca ubica.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.operations.components(trackId, cols),
        })
        return
      }

      // `operation-updated` llega con la operación completa: directo a la
      // cache, sin reempaquetar nada. El riel ordena por salud y actividad,
      // así que también le toca enterarse.
      const nextOperation = payload as Operation | null
      if (nextOperation) {
        queryClient.setQueryData(queryKeys.operations.detail(trackId), nextOperation)
        void queryClient.invalidateQueries({ queryKey: queryKeys.operations.list() })
      }
    },
    [queryClient, trackId, cols],
  )
  const stream = useOperationEvents(trackId, onOperationEvent)

  useEffect(() => {
    if (pending.length === 0) return
    const timers = pending.map(({ tempId }) =>
      setTimeout(() => {
        setPending((current) => current.filter((item) => item.tempId !== tempId))
      }, PENDING_TIMEOUT_MS),
    )
    return () => timers.forEach(clearTimeout)
  }, [pending])

  const pendingWidgets = useMemo<Widget[]>(
    () =>
      pending.map(({ tempId, estimatedSize }) => ({
        id: `pending-${tempId}`,
        ...WIDGET_SIZES[estimatedSize],
        col: 0,
        row: 0,
        title: t('operation.generated.pendingTitle'),
        fromAgent: true,
        body: <SkeletonText lines={2} />,
      })),
    [pending, t],
  )

  const widgets = useMemo(() => {
    const base = generated ? toWidgets(generated.components, generated.layout) : []
    return [...base, ...pendingWidgets]
  }, [generated, pendingWidgets])

  const persist = savePlacement.mutate
  const persistable = (generated?.components.length ?? 0) > 0

  const handleMove = useCallback(
    (id: string, position: number) => {
      if (persistable) persist({ id, position })
    },
    [persist, persistable],
  )

  const handleTitleChange = useCallback(
    (id: string, title: string) => {
      if (persistable) persist({ id, title })
    },
    [persist, persistable],
  )

  return (
    <div className="flex h-dvh flex-col gap-3 px-2 py-4 sm:px-4">
      {detail.isSuccess && <OperationDetailHeader operation={detail.data} waiting={waiting} stream={stream} />}

      {detail.isPending && (
        <div className="grid grid-cols-4 gap-3">
          <Skeleton className="col-span-4 h-64 rounded-xl" />
          <Skeleton className="col-span-2 h-32 rounded-xl" />
          <Skeleton className="col-span-2 h-32 rounded-xl" />
        </div>
      )}

      {detail.isError && <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />}

      {detail.isSuccess && components.isError && (
        <ErrorState error={components.error} onRetry={() => void components.refetch()} />
      )}

      {detail.isSuccess && !components.isError && (
        <GeneratedSurface className="flex-1">
          <SectionBoundary name="generated-ui">
            <ComponentDataProvider operation={operation}>
              <WidgetGrid
                widgets={widgets}
                onMove={handleMove}
                onTitleChange={handleTitleChange}
                onColsChange={setCols}
                reserve={railOpen ? railWidth : 0}
              />
            </ComponentDataProvider>
          </SectionBoundary>
        </GeneratedSurface>
      )}
    </div>
  )
}
