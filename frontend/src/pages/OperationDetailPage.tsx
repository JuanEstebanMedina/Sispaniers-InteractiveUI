import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'

import { api, api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { SectionBoundary } from '@/components/feedback/ErrorBoundary'
import { ErrorState } from '@/components/feedback/ErrorState'
import { WidgetGrid } from '@/components/generated/WidgetGrid'
import { demoWidgets } from '@/components/generated/demoWidgets'
import { GeneratedSurface } from '@/components/operations/GeneratedSurface'
import { OperationDetailHeader } from '@/components/operations/OperationDetailHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import type { GridItem } from '@/lib/grid'
import { flowListSchema, flowSchema } from '@/schemas'

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
    queryFn: () => api$.get(endpoints.operations.detail(trackId), flowSchema),
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
    queryFn: () => api$.get(endpoints.operations.list, flowListSchema),
  })
  const waiting = (others.data?.flows ?? []).filter(
    (flow) => flow.trackId !== trackId && flow.status === 'needs_decision',
  ).length

  const operation = detail.data
  // Memoized: a fresh widget array on every render would make the grid look
  // like it had rearranged itself, and persisting that would never settle.
  const widgets = useMemo(() => (operation ? demoWidgets(operation) : []), [operation])
  const save = saveLayout.mutate
  const handleLayoutChange = useCallback((layout: GridItem[]) => save(layout), [save])

  return (
    <div className="flex h-dvh flex-col gap-3 px-4 py-4 sm:px-gutter">
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
            <WidgetGrid widgets={widgets} onLayoutChange={handleLayoutChange} />
          </SectionBoundary>
        </GeneratedSurface>
      )}
    </div>
  )
}
