import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * "hace 2 días", with the exact timestamp on hover and in the markup.
 *
 * A relative label alone is unusable the moment someone needs to compare two
 * operations, so the absolute date stays one hover away and machine-readable
 * in `dateTime`.
 */
export function RelativeTime({ value, className }: { value: string; className?: string }) {
  return (
    <time
      dateTime={value}
      title={new Date(value).toLocaleString()}
      className={cn('text-xs text-fg-subtle', className)}
    >
      {formatRelative(value)}
    </time>
  )
}
