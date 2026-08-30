import { Link } from '@tanstack/react-router'

import { RelativeTime } from '@/components/ui/RelativeTime'
import { useShipperName } from '@/hooks'
import { cn } from '@/lib/cn'
import { needsAttention } from '@/lib/operation'
import type { Operation } from '@/schemas'
import { OperationStatusBadge } from './OperationStatus'

/**
 * A compressed `OperationCard`: same operation, a third of the height.
 *
 * It does not reuse the card because at 18rem wide the route and the health
 * chip do not fit, and half a dozen density props would have turned the card
 * into two components wearing one name.
 */
interface RailItemProps {
  operation: Operation
  active: boolean
  /** Closes the drawer on navigation: below xl the rail floats over the detail. */
  onNavigate?: () => void
}

export function RailItem({ operation, active, onNavigate }: RailItemProps) {
  const shipper = useShipperName(operation)

  return (
    <Link
      to="/operations/$trackId"
      params={{ trackId: operation.trackId }}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'block rounded-md border border-transparent px-3 py-2.5',
        'transition-colors duration-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active ? 'border-brand/40 bg-surface-active' : 'hover:bg-surface-hover',
        // Readable out of the corner of the eye, which is the only thing that
        // works while the attention is on the detail beside it.
        needsAttention(operation) && 'border-l-2 border-l-accent',
      )}
    >
      <p className="truncate text-sm font-medium text-fg">{shipper}</p>
      <p className="mt-0.5 font-mono text-xs text-fg-subtle tabular">{operation.trackId}</p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <OperationStatusBadge status={operation.status} size="sm" />
        <RelativeTime value={operation.updatedAt} className="shrink-0" />
      </div>
    </Link>
  )
}
