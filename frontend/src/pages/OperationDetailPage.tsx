import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'

import { api, api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { SectionBoundary } from '@/components/feedback/ErrorBoundary'
import { ErrorState } from '@/components/feedback/ErrorState'
import { toAiWidgets } from '@/components/generated/ComponentNodeRenderer'
import { WidgetGrid } from '@/components/generated/WidgetGrid'
import { demoWidgets } from '@/components/generated/demoWidgets'
import { GeneratedSurface } from '@/components/operations/GeneratedSurface'
import { OperationDetailHeader } from '@/components/operations/OperationDetailHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import type { GridItem } from '@/lib/grid'
import { componentsResponseSchema, operationListSchema, operationResponseSchema } from '@/schemas'
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

export default function OperationDetailPage() {
  const { trackId } = useParams({ from: '/app/operations/$trackId' })

  const detail = useQuery({
    queryKey: queryKeys.operations.detail(trackId),
    queryFn: () => api$.get(endpoints.operations.detail(trackId), operationResponseSchema),
    refetchInterval: 15_000,
  })

  // Fire-and-forget on purpose: a corrected layout must never block the run or
  // steal the screen with an error toast.
  const saveLayout = useMutation({
    mutationFn: (layout: GridItem[]) =>
      api.patch(endpoints.operations.layout(trackId), { layout }),
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

  const operation = detail.data

  // ponytail: hardcoded to 4 cols — thread the grid's own computed column
  // count down here once there's a clean way to do it, not a blocker now.
  const aiComponents = useQuery({
    queryKey: queryKeys.operations.components(trackId, 4),
    queryFn: () => api$.get(endpoints.ai.components(trackId, 4), componentsResponseSchema),
  })

  const widgets = useMemo(
    () => (operation ? [...demoWidgets(operation), ...toAiWidgets(aiComponents.data?.components ?? [])] : []),
    [operation, aiComponents.data],
  )
  const save = saveLayout.mutate
  const handleLayoutChange = useCallback((layout: GridItem[]) => save(layout), [save])

  return (
    <div className="flex h-dvh flex-col gap-3 px-2 py-4 sm:px-4">
      {detail.isSuccess && <OperationDetailHeader operation={detail.data} waiting={waiting} />}

      {detail.isPending && (
        <div className="grid grid-cols-4 gap-3">
          <Skeleton className="col-span-4 h-64 rounded-xl" />
          <Skeleton className="col-span-2 h-32 rounded-xl" />
          <Skeleton className="col-span-2 h-32 rounded-xl" />
        </div>
      )}

      {detail.isError && <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />}

      {detail.isSuccess && (
        <GeneratedSurface className="flex-1">
          <SectionBoundary name="generated-ui">
            <WidgetGrid
              widgets={widgets}
              onLayoutChange={handleLayoutChange}
              reserve={railOpen ? railWidth : 0}
            />
          </SectionBoundary>
        </GeneratedSurface>
      )}
    </div>
  )
}
