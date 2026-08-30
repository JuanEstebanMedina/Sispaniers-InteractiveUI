import { Loader2 } from 'lucide-react'
import type { HTMLAttributes } from 'react'

import { t } from '@/i18n'
import { cn } from '@/lib/cn'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton h-4 w-full', className)}
      aria-hidden
      {...props}
    />
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3.5', index === lines - 1 && 'w-3/5')} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full" aria-busy>
      <div className="flex h-row-dense items-center gap-4 border-b border-line px-4">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex h-row items-center gap-4 border-b border-line-subtle px-4">
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn('h-3.5 flex-1', colIndex === 0 && 'max-w-40')}
              style={{ opacity: 1 - rowIndex * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="surface-card p-gutter" aria-busy>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  )
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-fg-muted">
      <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden />
      {label && <span className="text-sm">{label}</span>}
      <span className="sr-only">{label ?? t('states.loading')}</span>
    </span>
  )
}
