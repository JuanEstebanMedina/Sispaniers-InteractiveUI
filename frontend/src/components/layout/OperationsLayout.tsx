import { useQuery } from '@tanstack/react-query'
import { Outlet, useParams } from '@tanstack/react-router'

import { api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { OperationsRail } from '@/components/operations/OperationsRail'
import { operationListSchema } from '@/schemas'
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
 * EL RIEL PIDE SIEMPRE LA LISTA SIN FILTRAR, y por eso usa `GET /operations`
 * mientras la grilla usa `POST /operations/search` con los filtros de la URL.
 * Son dos claves de caché distintas a propósito: los filtros responden "qué
 * busco" y el riel "qué más está pasando". Si el riel heredara el filtro,
 * buscar "entregado" escondería justo la operación que se acaba de romper.
 *
 * El costo es una petición extra al abrir un detalle con la grilla filtrada.
 * Vale la pena: la alternativa es un panel de vigilancia que deja de vigilar
 * en cuanto alguien escribe en el buscador.
 */

export default function OperationsLayout() {
  // `strict: false` porque este layout también se monta en la ruta índice,
  // donde no hay `trackId`.
  const { trackId } = useParams({ strict: false }) as { trackId?: string }
  const hasDetail = Boolean(trackId)

  const railOpen = useRailStore((state) => state.open)

  const list = useQuery({
    queryKey: queryKeys.operations.list(),
    queryFn: () =>
      api$.get(endpoints.operations.list, operationListSchema),
    // Sólo cuando hay un detalle abierto. En la grilla este layout igual se
    // monta, pero `hasDetail` es false y el riel no se renderiza: sin esto se
    // descargaba la lista entera para no mostrarla, EN PARALELO con el POST
    // /operations/search que sí alimenta la grilla.
    enabled: hasDetail,
    // Lo que hace cierto el "ver si hay cambios en las otras". Sin esto el riel
    // es una foto del momento en que se hizo clic.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  const operations = list.data?.operations ?? []

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
        />
      )}
    </div>
  )
}
