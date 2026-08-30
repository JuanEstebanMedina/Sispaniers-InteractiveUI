import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Operation } from '@/schemas'
import { OperationCard } from './OperationCard'

const COLUMNS = 'grid grid-cols-1 gap-stack sm:grid-cols-2 xl:grid-cols-3'

interface OperationsGridProps {
  operations: Operation[]
  loading: boolean
  error: unknown
  onRetry: () => void
  filtered: boolean
  onClearFilters: () => void
  activeTrackId?: string
}

/**
 * Four states, and the distinction between the last two is the one that usually
 * goes missing: "nothing here" sends someone looking for a broken system when
 * all that happened is a filter left on.
 */
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
