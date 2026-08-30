import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { api$, toQuery } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { OperationsFilters } from '@/components/operations/OperationsFilters'
import { OperationsGrid } from '@/components/operations/OperationsGrid'
import { flowListSchema } from '@/schemas'

/**
 * GRILLA DE OPERACIONES — la pantalla principal
 *
 * Esta página sólo se ocupa de la URL: lee los filtros de los search params,
 * pide los datos y se los pasa a `OperationsGrid`, que es quien pinta. Esa
 * división permite reusar la grilla en otro sitio sin arrastrar los search
 * params, y probarla sin montar un router.
 *
 * El orden por defecto es `updatedAt desc` y no fecha de creación: la pregunta
 * que responde la pantalla es «¿qué cambió mientras no estaba mirando?».
 */

export default function OperationsPage() {
  const { t } = useTranslation('domain')
  const search = useSearch({ from: '/app/operations/' })
  const navigate = useNavigate()

  const list = useQuery({
    queryKey: queryKeys.operations.list(search),
    queryFn: () =>
      api$.get(
        // El backend filtra por status/health/search; NO ordena ni pagina, así
        // que el orden se hace acá abajo sobre el resultado.
        endpoints.operations.list +
          toQuery({ status: search.status, health: search.health, search: search.q }),
        flowListSchema,
      ),
    refetchInterval: 15_000,
  })

  const operations = useMemo(() => {
    const rows = list.data?.flows ?? []
    const direction = search.order === 'asc' ? 1 : -1

    // Copia antes de ordenar: `rows` sale de la caché de React Query.
    return [...rows].sort((a, b) => {
      if (search.sort === 'shipper') return a.shipper.localeCompare(b.shipper) * direction
      if (search.sort === 'trackId') return a.trackId.localeCompare(b.trackId) * direction
      return (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)) * direction
    })
  }, [list.data, search.sort, search.order])

  const filtered = Boolean(search.q) || search.status !== 'all' || search.health !== 'all'

  return (
    <PageContainer wide>
      <PageHeader title={t('operation.title')} description={t('operation.subtitle')} />

      <div className="mb-section">
        <OperationsFilters search={search} total={list.data?.flows.length} />
      </div>

      <OperationsGrid
        operations={operations}
        loading={list.isPending}
        error={list.isError ? list.error : undefined}
        onRetry={() => void list.refetch()}
        filtered={filtered}
        onClearFilters={() =>
          void navigate({
            to: '/operations',
            search: { q: undefined, status: 'all', health: 'all' },
          })
        }
      />
    </PageContainer>
  )
}
