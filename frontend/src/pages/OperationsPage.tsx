import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { OperationsFilters } from '@/components/operations/OperationsFilters'
import { OperationsGrid } from '@/components/operations/OperationsGrid'
import { operationListSchema } from '@/schemas'

/** La web habla en su vocabulario; el backend en el suyo. La traducción vive
 *  acá, en el único sitio que conoce los dos. */
const HEALTH_TO_BACKEND: Record<string, string> = {
  on_track: 'ok',
  at_risk: 'warning',
  critical: 'error',
}

const SORT_TO_BACKEND: Record<string, string> = {
  updatedAt: 'updatedAt',
  shipper: 'company',
  trackId: 'id',
}

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

  // El backend filtra Y ordena: la web ya no lo hace en memoria, porque el
  // cliente sólo podría ordenar dentro de lo que alcanzó a descargar.
  const list = useQuery({
    queryKey: queryKeys.operations.list(search),
    queryFn: () =>
      api$.post(
        endpoints.operations.search,
        operationListSchema,
        {
          ...(search.q ? { search: search.q } : {}),
          ...(search.status !== 'all' ? { status: search.status } : {}),
          ...(search.health !== 'all' ? { health: HEALTH_TO_BACKEND[search.health] } : {}),
          sort_by: SORT_TO_BACKEND[search.sort] ?? 'updatedAt',
          sort_dir: search.order,
        },
      ),
    refetchInterval: 15_000,
  })

  const operations = list.data?.operations ?? []

  const filtered = Boolean(search.q) || search.status !== 'all' || search.health !== 'all'

  return (
    <PageContainer wide>
      <PageHeader title={t('operation.title')} description={t('operation.subtitle')} />

      <div className="mb-section">
        <OperationsFilters search={search} total={list.data?.operations.length} />
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
