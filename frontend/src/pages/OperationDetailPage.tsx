import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'

import { api, api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { SectionBoundary } from '@/components/feedback/ErrorBoundary'
import { ErrorState } from '@/components/feedback/ErrorState'
import { WidgetGrid } from '@/components/generated/WidgetGrid'
import { demoWidgets } from '@/components/generated/demoWidgets'
import { toWidgets } from '@/components/generated/toWidgets'
import { GeneratedSurface } from '@/components/operations/GeneratedSurface'
import { OperationDetailHeader } from '@/components/operations/OperationDetailHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  operationComponentsSchema,
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
        operationComponentsSchema,
      ),
  })

  // Fire-and-forget on purpose: moving or renaming a widget must never block
  // the run or steal the screen with an error toast.
  const savePlacement = useMutation({
    mutationFn: ({ id, ...body }: { id: string; position?: number; title?: string }) =>
      api.patch(endpoints.operations.componentPlacement(trackId, id), body),
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
  
  const generated = components.data

  // Mientras el agente no haya escrito nada para esta operación, la pantalla
  // sigue mostrando los bloques de demostración en vez de quedarse en blanco.
  const widgets = useMemo(() => {
    if (generated && generated.components.length > 0) {
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
              onMove={handleMove}
              onTitleChange={handleTitleChange}
              onColsChange={setCols}
              reserve={railOpen ? railWidth : 0}
            />
          </SectionBoundary>
        </GeneratedSurface>
      )}
    </div>
  )
}
