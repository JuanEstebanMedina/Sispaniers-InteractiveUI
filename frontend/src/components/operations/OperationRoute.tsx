import { ArrowRight } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * Origin to destination.
 *
 * Both ports truncate independently: a long name like "VNSGN Ho Chi Minh"
 * would otherwise push the arrow and the destination out of a narrow card.
 */
export function OperationRoute({
  from,
  to,
  className,
}: {
  from: string
  to: string
  className?: string
}) {
  if (!from && !to) return null

  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <span className="truncate">{from}</span>
      <ArrowRight className="size-3 shrink-0 text-fg-subtle" aria-hidden />
      <span className="truncate">{to}</span>
    </span>
  )
}
