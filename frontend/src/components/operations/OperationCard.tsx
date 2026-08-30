import { Link } from '@tanstack/react-router'
import { ArrowRight, Container } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useCompanyDirectory } from '@/hooks'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import type { Operation } from '@/schemas'
import { HealthChip, OperationStatusBadge } from './OperationStatus'

interface OperationCardProps {
  operation: Operation
  active?: boolean
  className?: string
}

export function OperationCard({ operation, active = false, className }: OperationCardProps) {
  const { t } = useTranslation(['domain', 'common'])
  const companies = useCompanyDirectory()

  const needsAttention = operation.health === 'critical'
  const shipper = companies[operation.companyIds[0] ?? ''] ?? operation.shipper

  return (
    <Link
      to="/operations/$trackId"
      params={{ trackId: operation.trackId }}
      className={cn(
        'group flex flex-col rounded-lg border bg-surface p-card',
        'transition-[border-color,box-shadow,background-color] duration-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'pointer-fine:hover:border-line-strong pointer-fine:hover:shadow-sm',

        needsAttention ? 'border-accent/40 border-l-2 border-l-accent' : 'border-line',
        active && 'border-brand ring-1 ring-brand',
        className,
      )}
      aria-current={active ? 'true' : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <OperationStatusBadge status={operation.status} size="sm" />
        <span
          className="shrink-0 font-mono text-xs text-fg-subtle tabular"
          title={t('domain:operation.fields.trackId')}
        >
          {operation.trackId}
        </span>
      </div>

      <div className="mt-3 min-w-0 flex-1">
        <p className="line-clamp-2 text-base font-medium leading-snug text-fg">{shipper}</p>

        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-fg-muted">
          <span className="truncate">{operation.origin}</span>
          <ArrowRight className="size-3 shrink-0 text-fg-subtle" aria-hidden />
          <span className="truncate">{operation.destination}</span>
        </p>

        {operation.containers > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-subtle">
            <Container className="size-3 shrink-0" aria-hidden />
            {t('domain:operation.containers', { count: operation.containers })}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-subtle pt-3">
        <time
          className="truncate text-xs text-fg-subtle"
          dateTime={operation.updatedAt}
          title={new Date(operation.updatedAt).toLocaleString()}
        >
          {formatRelative(operation.updatedAt)}
        </time>
        <HealthChip health={operation.health} />
      </div>
    </Link>
  )
}
