import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import type { Operation } from '@/schemas'
import { AgentChat } from './AgentChat'
import { RailItem } from './RailItem'

/**
 * The right-hand panel: talking to the agent on top, every other operation
 * below.
 *
 * It is a column, never an overlay — it shares the row with the content and
 * pushes it, the way the sidebar does. A panel that floats on top hides the
 * very thing you opened it beside, which defeats keeping the other operations
 * in view while you work on this one.
 *
 * It sits on the RIGHT because on the left it competed with the menu: two
 * navigation columns side by side make you choose which one to read. With the
 * content between them, the menu answers "where can I go" and this answers
 * "what else is happening".
 *
 * The ones waiting on a person come FIRST. If the agent is blocked waiting for
 * someone, that cannot end up below the scroll.
 */

interface OperationsRailProps {
  operations: Operation[]
  activeTrackId: string | undefined
  loading?: boolean
  open: boolean
  onClose: () => void
}

export function OperationsRail({
  operations,
  activeTrackId,
  loading,
  open,
  onClose,
}: OperationsRailProps) {
  const { t } = useTranslation('domain')

  const sorted = useMemo(() => {
    const waiting = (operation: Operation) => (operation.status === 'needs_decision' ? 0 : 1)
    // Copy before sorting: `operations` comes from the React Query cache and
    // sorting it in place corrupts what every other consumer sees.
    return [...operations].sort(
      (a, b) => waiting(a) - waiting(b) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    )
  }, [operations])

  if (!open) return null

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-dvh w-72 shrink-0 flex-col',
        'border-l border-line bg-surface',
      )}
      aria-label={t('operation.rail.title')}
    >
      <AgentChat className="max-h-[45%] shrink-0 border-b border-line" />

      <div className="flex shrink-0 items-center justify-between gap-2 px-card py-2.5">
        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {t('operation.rail.title')}
        </h2>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="shrink-0"
          aria-label={t('operation.rail.hide')}
          title={t('operation.rail.hide')}
        >
          <ChevronRight />
        </Button>
      </div>

      {/* The overflow lives here and not on the <aside>: the chat and the
          heading stay put and only the list scrolls. */}
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {loading && operations.length === 0
          ? Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="rounded-md p-3">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="mt-2 h-2.5 w-1/3" />
              </li>
            ))
          : sorted.map((operation) => (
              <li key={operation.trackId}>
                <RailItem operation={operation} active={operation.trackId === activeTrackId} />
              </li>
            ))}
      </ul>
    </aside>
  )
}
