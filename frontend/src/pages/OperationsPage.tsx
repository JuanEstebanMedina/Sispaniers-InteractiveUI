import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { OperationsFilters } from '@/components/operations/OperationsFilters'
import { OperationsGrid } from '@/components/operations/OperationsGrid'
import { operationListSchema, resolveOperationsSearch } from '@/schemas'

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
export default function OperationsPage() {
  const { t } = useTranslation('domain')
  // La URL sólo lleva lo que alguien cambió; acá se rellenan los ausentes.
  const raw = useSearch({ from: '/app/operations/' })
  const search = resolveOperationsSearch(raw)
  const navigate = useNavigate()

  const body = useMemo(
    () => ({
      ...(search.q ? { search: search.q } : {}),
      ...(search.status !== 'all' ? { status: search.status } : {}),
      ...(search.health !== 'all' ? { health: HEALTH_TO_BACKEND[search.health] } : {}),
      ...(search.sort !== 'updatedAt' ? { sort_by: SORT_TO_BACKEND[search.sort] } : {}),
      ...(search.order !== 'desc' ? { sort_dir: search.order } : {}),
    }),
    [search.q, search.status, search.health, search.sort, search.order],
  )

  const list = useQuery({
    queryKey: queryKeys.operations.list(body),
    queryFn: () => api$.post(endpoints.operations.search, operationListSchema, body),
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
            // `undefined` en todos: limpiar filtros deja la URL en
            // `/operations` pelada, que es lo que "sin filtros" significa.
            search: { q: undefined, status: undefined, health: undefined },
          })
        }
      />
    </PageContainer>
  )
}
