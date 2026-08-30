import { useQuery } from '@tanstack/react-query'
import { Outlet, useParams } from '@tanstack/react-router'

import { api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { OperationsRail } from '@/components/operations/OperationsRail'
import { flowListSchema } from '@/schemas'
import { useRailStore } from '@/stores/railStore'

/**
 * LAYOUT DE OPERACIONES — el que sostiene el riel
 *
 *   /operations              la grilla, a todo el ancho
 *   /operations/$trackId     [ detalle | riel ]
 *
 * POR QUÉ EL RIEL VIVE ACÁ Y NO EN LA PÁGINA DE DETALLE
 *
 * Es el requisito entero de la pantalla: al abrir una operación, las demás
 * siguen visibles. Si el riel estuviera dentro de `OperationDetailPage`, cada
 * clic lo desmontaría y lo volvería a montar — perdería el scroll y
 * parpadearía. Siendo ruta de layout, el router sólo cambia el hijo.
 *
 * El panel es una COLUMNA y no un cajón flotante: comparte la fila con el
 * contenido y lo empuja, como el sidebar. Su interruptor vive en la cabecera
 * del detalle, así que el estado está en `railStore` — cabecera y layout son
 * hermanos de ruta y no hay props entre ellos.
 *
 * Una sola consulta alimenta las dos vistas: `queryKeys.operations.list()` es
 * la misma clave que usa la grilla, así al abrir una operación el riel sale de
 * caché sin refetch ni parpadeo. Y pide SIEMPRE la lista sin filtrar aunque la
 * grilla esté filtrada: los filtros responden "qué busco" y el riel "qué más
 * está pasando" — filtrar por "entregado" escondería justo la que se rompió.
 */

export default function OperationsLayout() {
  // `strict: false` porque este layout también se monta en la ruta índice,
  // donde no hay `trackId`.
  const { trackId } = useParams({ strict: false }) as { trackId?: string }
  const hasDetail = Boolean(trackId)

  const railOpen = useRailStore((state) => state.open)
  const setOpen = useRailStore((state) => state.setOpen)

  const list = useQuery({
    queryKey: queryKeys.operations.list(),
    queryFn: () =>
      api$.get(endpoints.operations.list, flowListSchema),
    // Lo que hace cierto el "ver si hay cambios en las otras". Sin esto el riel
    // es una foto del momento en que se hizo clic.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  const operations = list.data?.flows ?? []

  return (
    <div className="flex min-h-dvh">
      {/* min-w-0: sin esto una tabla ancha del detalle estira el flex y empuja
          el riel fuera de pantalla. Es el bug clásico de flexbox. */}
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>

      {hasDetail && (
        <OperationsRail
          operations={operations}
          activeTrackId={trackId}
          loading={list.isPending}
          open={railOpen}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
