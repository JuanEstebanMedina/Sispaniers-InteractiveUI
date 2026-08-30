import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, Container, Copy, MessageSquare } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useCopyToClipboard } from '@/hooks'
import { cn } from '@/lib/cn'
import { formatDate, formatRelative } from '@/lib/format'
import type { Operation } from '@/schemas'
import { useRailStore } from '@/stores/railStore'
import { HealthChip, OperationStatusBadge } from './OperationStatus'

/** Vertical rule between facts. Collapses on its own when a fact is absent. */
function Divider() {
  return <span aria-hidden className="h-3 w-px shrink-0 bg-line" />
}

function Fact({ children }: { children: ReactNode }) {
  return <span className="flex min-w-0 shrink-0 items-center gap-1.5">{children}</span>
}

interface OperationDetailHeaderProps {
  operation: Operation
  /** Operations waiting on a person, for the mark on the panel toggle. */
  waiting?: number
}

/**
 * Top bar of the detail view: the name on its own line, every other fact on a
 * single divided row underneath.
 *
 * Kept deliberately short — it is chrome, and every pixel it takes is a pixel
 * the generated grid below does not get.
 */
export function OperationDetailHeader({ operation, waiting = 0 }: OperationDetailHeaderProps) {
  const { t } = useTranslation(['domain', 'common'])
  const { copy, copied } = useCopyToClipboard()
  const railOpen = useRailStore((state) => state.open)
  const toggleRail = useRailStore((state) => state.toggle)

  const facts: ReactNode[] = [
    <Fact key="status">
      <OperationStatusBadge status={operation.status} size="sm" />
      <HealthChip health={operation.health} />
    </Fact>,

    operation.origin && operation.destination ? (
      <Fact key="route">
        <span className="truncate">{operation.origin}</span>
        <ArrowRight className="size-3 shrink-0 text-fg-subtle" aria-hidden />
        <span className="truncate">{operation.destination}</span>
      </Fact>
    ) : null,

    operation.containers > 0 ? (
      <Fact key="containers">
        <Container className="size-3 text-fg-subtle" aria-hidden />
        {t('domain:operation.containers', { count: operation.containers })}
      </Fact>
    ) : null,

    operation.eta ? (
      <Fact key="eta">
        <span className="text-fg-subtle">{t('domain:operation.fields.eta')}</span>
        {formatDate(operation.eta)}
      </Fact>
    ) : null,

    <Fact key="updated">
      <span className="text-fg-subtle">
        {t('domain:operation.updatedAgo', { when: formatRelative(operation.updatedAt) })}
      </span>
    </Fact>,
  ].filter(Boolean)

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-line pb-2.5">
      <Link
        to="/operations"
        aria-label={t('domain:operation.rail.backToGrid')}
        title={t('domain:operation.rail.backToGrid')}
        className={cn(
          'flex size-control-sm shrink-0 items-center justify-center rounded-md',
          'border border-line text-fg-muted transition-colors',
          'hover:bg-surface-hover hover:text-fg',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        <ArrowLeft className="size-4" aria-hidden />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 truncate font-display text-md font-semibold tracking-tight text-fg">
            {operation.shipper}
          </h1>

        <button
          type="button"
          onClick={() => void copy(operation.trackId, t('domain:operation.trackIdCopied'))}
          aria-label={t('common:actions.copy')}
          className={cn(
            'group flex min-w-0 shrink items-center gap-1.5 rounded-xs px-1.5 py-0.5',
            'font-mono text-2xs text-fg-subtle tabular transition-colors',
            'hover:bg-surface-hover hover:text-fg-muted',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          )}
        >
          <span className="truncate">{operation.trackId}</span>
          {copied ? (
            <Check className="size-3 shrink-0 text-success" aria-hidden />
          ) : (
            <Copy
              className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          )}
        </button>

        </div>

        {/* Scrolls sideways rather than wrapping: a second line here would eat
            another row of the grid on every narrow screen. */}
        <div
          className={cn(
            'mt-1 flex items-center gap-2.5 overflow-x-auto text-xs text-fg-muted',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {facts.map((fact, index) => (
            <div key={index} className="flex shrink-0 items-center gap-2.5">
              {index > 0 && <Divider />}
              {fact}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={toggleRail}
        aria-expanded={railOpen}
        aria-label={t(railOpen ? 'domain:operation.rail.hide' : 'domain:operation.rail.show')}
        title={t(railOpen ? 'domain:operation.rail.hide' : 'domain:operation.rail.show')}
        className={cn(
          'relative flex size-control-sm shrink-0 items-center justify-center rounded-md',
          'border border-line text-fg-muted transition-colors',
          'hover:bg-surface-hover hover:text-fg',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        <MessageSquare className="size-4" aria-hidden />
        {/* With the panel closed this button is the only sign that something is
            waiting on a person, so it has to carry the mark. */}
        {!railOpen && waiting > 0 && (
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent" aria-hidden />
        )}
      </button>
    </header>
  )
}
