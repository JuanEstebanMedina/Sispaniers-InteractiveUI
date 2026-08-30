import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FilterSelect } from '@/components/ui/FilterSelect'
import { SearchInput } from '@/components/ui/Input'
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

      <FilterSelect
        label={t('domain:operation.filters.status')}
        value={search.status}
        onChange={(status) => update({ status })}
        options={[
          { value: 'all', label: t('domain:operation.filters.allStatuses') },
          ...CONTAINER_STATES.map((status) => ({
            value: status,
            label: t(`domain:operation.status.${status}` as never),
          })),
        ]}
        className="sm:w-44"
      />

      <FilterSelect
        label={t('domain:operation.filters.health')}
        value={search.health}
        onChange={(health) => update({ health })}
        options={[
          { value: 'all', label: t('domain:operation.filters.allHealth') },
          ...OPERATION_HEALTH.map((health) => ({
            value: health,
            label: t(`domain:operation.health.${health}` as never),
          })),
        ]}
        className="sm:w-40"
      />

      <FilterSelect
        label={t('domain:operation.filters.sort')}
        value={`${search.sort}:${search.order}`}
        onChange={(picked) => {
          const [sort, order] = picked.split(':')
          update({ sort, order: order as 'asc' | 'desc' })
        }}
        options={[
          { value: 'updatedAt:desc', label: t('domain:operation.filters.newestFirst') },
          { value: 'updatedAt:asc', label: t('domain:operation.filters.oldestFirst') },
          { value: 'shipper:asc', label: t('domain:operation.filters.byShipper') },
          { value: 'trackId:asc', label: t('domain:operation.filters.byTrackId') },
        ]}
        className="col-span-2 sm:col-span-1 sm:w-48"
      />

      {total !== undefined && (
        <span className="col-span-2 text-xs text-fg-subtle tabular">
          {t('domain:operation.filters.results', { count: total })}
        </span>
      )}
    </div>
  )
}
