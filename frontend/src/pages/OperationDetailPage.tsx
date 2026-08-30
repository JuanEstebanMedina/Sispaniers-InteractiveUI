import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api, api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { normalizeError } from '@/api/errors'
import { SectionBoundary } from '@/components/feedback/ErrorBoundary'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ComponentDataProvider } from '@/components/generated/ComponentData'
import { WidgetGrid } from '@/components/generated/WidgetGrid'
import { demoWidgets } from '@/components/generated/demoWidgets'
import { sampleDatasets } from '@/components/generated/sampleComponents'
import { toWidgets } from '@/components/generated/toWidgets'
import { useComponentStream } from '@/components/generated/useComponentStream'
import { GeneratedSurface } from '@/components/operations/GeneratedSurface'
import { OperationDetailHeader } from '@/components/operations/OperationDetailHeader'
import { ConfirmModal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/lib/toast'
import {
  type ComponentsResponse,
  componentsResponseSchema,
  operationListSchema,
  operationResponseSchema,
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
  const { trackId } = useParams({ from: '/app/operations/$trackId' })
  const { t } = useTranslation('domain')
  const queryClient = useQueryClient()

  const detail = useQuery({
    queryKey: queryKeys.operations.detail(trackId),
    queryFn: () => api$.get(endpoints.operations.detail(trackId), operationResponseSchema),
    refetchInterval: 15_000,
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

  /** Widget the user asked to remove, waiting on the confirmation modal. */
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  // Chained behind the same queue as the moves: deleting renumbers the whole
  // sequence, so a placement PATCH that lands after it would renumber from
  // positions that no longer exist. Unlike a move, a failed delete DOES speak
  // up — the widget is still on screen and the user has to know why.
  const removeComponent = useMutation({
    mutationFn: (id: string) => {
      const sent = inFlight.current.then(() =>
        api.delete(endpoints.operations.componentRemove(trackId, id)),
      )
      inFlight.current = sent.catch(() => undefined)
      return sent
    },
    onSuccess: (_result, id) => {
      setPendingDelete(null)
      // There is one cache entry per width the user has already been at, and
      // only the one on screen refreshes itself. Dropping the component from
      // that entry alone leaves it alive in the siblings, and it comes back the
      // moment the window resizes — opening devtools is enough.
      queryClient.setQueriesData<ComponentsResponse>(
        { queryKey: queryKeys.operations.componentsAll(trackId) },
        (cached) =>
          cached && {
            components: cached.components.filter((component) => component.id !== id),
            layout: cached.layout.filter((entry) => entry.id !== id),
          },
      )
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.componentsAll(trackId),
      })
    },
    onError: (error) => {
      setPendingDelete(null)
      toast.error(t('operation.generated.deleteError'), {
        description: normalizeError(error).message,
      })
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

  // Live updates: the agent writes a component and the grid restructures
  // without anyone reloading.
  const stream = useComponentStream(trackId, cols)

  const operation = detail.data
  const generated = components.data

  // Los bloques de demostración son para una operación que el agente todavía no
  // ha tocado, NO para una que no se pudo leer: son datos fabricados y en una
  // pantalla logística se leen igual que los de verdad. Por eso hacen falta los
  // `generated`: sin respuesta buena no se pinta nada y la página muestra el
  // error o el esqueleto.
  const widgets = useMemo(() => {
    if (!generated) return []
    if (generated.components.length > 0) {
      return toWidgets(generated.components, generated.layout)
    }
    return operation ? demoWidgets(operation) : []
  }, [generated, operation])

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

  // The demo blocks do not exist in the backend: there is nothing to delete, so
  // the widget does not even offer the button.
  const handleDeleteRequest = useMemo(
    () => (persistable ? setPendingDelete : undefined),
    [persistable],
  )

  const pendingTitle = widgets.find((widget) => widget.id === pendingDelete)?.title ?? ''

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
            <ComponentDataProvider operation={operation} datasets={sampleDatasets}>
            <WidgetGrid
              widgets={widgets}
              onMove={handleMove}
              onTitleChange={handleTitleChange}
              onColsChange={setCols}
              onDeleteRequest={handleDeleteRequest}
              reserve={railOpen ? railWidth : 0}
            />
            </ComponentDataProvider>
          </SectionBoundary>
        </GeneratedSurface>
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) removeComponent.mutate(pendingDelete)
        }}
        title={t('operation.generated.deleteTitle')}
        message={t('operation.generated.deleteMessage', { title: pendingTitle })}
        confirmLabel={t('operation.generated.deleteConfirm')}
        loading={removeComponent.isPending}
      />
    </div>
  )
}
