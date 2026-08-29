import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Operation } from '@/schemas'
import { OperationCard } from './OperationCard'

/**
 * La grilla y sus cuatro estados.
 *
 * Está separada de la página porque la página se ocupa de la URL (filtros,
 * query) y esto sólo de pintar una lista. Así se puede reusar tal cual en
 * cualquier otro sitio que ya tenga operaciones — por ejemplo un panel del
 * detalle— sin arrastrar los search params.
 *
 * La distinción entre "vacío" y "sin resultados" es la que suele faltar:
 * "no hay nada" hace pensar que el sistema está vacío cuando lo único que
 * pasa es que el filtro está de más, y manda a buscar el problema donde no
 * está.
 */

const COLUMNS = 'grid grid-cols-1 gap-stack sm:grid-cols-2 xl:grid-cols-3'

interface OperationsGridProps {
  operations: Operation[]
  loading: boolean
  error: unknown
  onRetry: () => void
  /** Hay filtros puestos: cambia el estado vacío por "sin resultados". */
  filtered: boolean
  onClearFilters: () => void
  /** Marca una tarjeta como la abierta. */
  activeTrackId?: string
}

export function OperationsGrid({
  operations,
  loading,
  error,
  onRetry,
  filtered,
  onClearFilters,
  activeTrackId,
}: OperationsGridProps) {
  const { t } = useTranslation(['domain', 'common'])

  if (loading) return <OperationsGridSkeleton />

  if (error) return <ErrorState error={error} onRetry={onRetry} />

  if (operations.length === 0) {
    return (
      <EmptyState
        variant={filtered ? 'no-results' : 'empty'}
        title={filtered ? undefined : t('domain:operation.emptyTitle')}
        description={filtered ? undefined : t('domain:operation.emptyHint')}
        action={
          filtered ? (
            <Button variant="secondary" onClick={onClearFilters}>
              {t('common:actions.clearFilters')}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className={COLUMNS}>
      {operations.map((operation) => (
        <OperationCard
          key={operation.trackId}
          operation={operation}
          active={operation.trackId === activeTrackId}
        />
      ))}
    </div>
  )
}

/**
 * Esqueletos con la FORMA de la tarjeta, no un spinner centrado.
 *
 * Seis y no tres: llenan el alto de la pantalla, así el layout no salta
 * cuando llegan las veinticuatro de verdad.
 */
export function OperationsGridSkeleton() {
  const { t } = useTranslation('common')

  return (
    <div className={COLUMNS} aria-busy aria-label={t('states.loading')}>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="rounded-lg border border-line bg-surface p-card">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="mt-4 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <Skeleton className="mt-6 h-3 w-full" />
        </div>
      ))}
    </div>
  )
}
