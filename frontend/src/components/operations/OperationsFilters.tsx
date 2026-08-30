import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SearchInput, Select } from '@/components/ui/Input'
import { useDebouncedValue } from '@/hooks'
import { CONTAINER_STATES, OPERATION_HEALTH, type OperationsSearch } from '@/schemas'

interface OperationsFiltersProps {
  search: OperationsSearch
  total: number | undefined
}

export function OperationsFilters({ search, total }: OperationsFiltersProps) {
  const { t } = useTranslation(['domain', 'common'])
  const navigate = useNavigate()

  const [query, setQuery] = useState(search.q ?? '')
  const debounced = useDebouncedValue(query, 300)

  useEffect(() => {
    if ((search.q ?? '') === debounced) return
    void navigate({
      to: '/operations',
      search: (previous) => ({ ...previous, q: debounced || undefined }),
      replace: true,
    })
  }, [debounced, navigate, search.q])

  useEffect(() => {
    setQuery(search.q ?? '')
  }, [search.q])

  const update = (patch: Partial<OperationsSearch>) => {
    void navigate({
      to: '/operations',
      search: (previous) => ({ ...previous, ...patch }),
    })
  }

  return (
    /* Móvil: rejilla de dos columnas. Tres selectores apilados a ancho completo
       comen media pantalla antes de ver una sola tarjeta. Desde sm vuelve a ser
       una fila que envuelve. */
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
      {/* El buscador va primero en móvil (es lo que más se usa) y último en
          escritorio, empujado a la derecha. */}
      <SearchInput
        size="sm"
        value={query}
        onValueChange={setQuery}
        placeholder={t('domain:operation.filters.searchPlaceholder')}
        className="col-span-2 sm:order-last sm:ml-auto sm:w-64"
      />

      <Select
        size="sm"
        aria-label={t('domain:operation.filters.status')}
        value={search.status}
        onChange={(event) => update({ status: event.target.value })}
        options={[
          { value: 'all', label: t('domain:operation.filters.allStatuses') },
          ...CONTAINER_STATES.map((status) => ({
            value: status,
            label: t(`domain:operation.status.${status}` as never),
          })),
        ]}
        className="sm:w-auto sm:min-w-44"
      />

      <Select
        size="sm"
        aria-label={t('domain:operation.filters.health')}
        value={search.health}
        onChange={(event) => update({ health: event.target.value })}
        options={[
          { value: 'all', label: t('domain:operation.filters.allHealth') },
          ...OPERATION_HEALTH.map((health) => ({
            value: health,
            label: t(`domain:operation.health.${health}` as never),
          })),
        ]}
        className="sm:w-auto sm:min-w-40"
      />

      <Select
        size="sm"
        aria-label={t('domain:operation.filters.sort')}
        value={`${search.sort}:${search.order}`}
        onChange={(event) => {
          const [sort, order] = event.target.value.split(':')
          update({ sort, order: order as 'asc' | 'desc' })
        }}
        options={[
          { value: 'updatedAt:desc', label: t('domain:operation.filters.newestFirst') },
          { value: 'updatedAt:asc', label: t('domain:operation.filters.oldestFirst') },
          { value: 'shipper:asc', label: t('domain:operation.filters.byShipper') },
          { value: 'trackId:asc', label: t('domain:operation.filters.byTrackId') },
        ]}
        className="col-span-2 sm:w-auto sm:min-w-48"
      />

      {total !== undefined && (
        <span className="col-span-2 text-xs text-fg-subtle tabular">
          {t('domain:operation.filters.results', { count: total })}
        </span>
      )}
    </div>
  )
}
