import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

import { cn } from '@/lib/cn'
import { formatPercent } from '@/lib/format'
import { Skeleton } from '@/components/ui/Skeleton'

interface StatCardProps {
  label: string
  value: ReactNode
  delta?: number | null
  deltaLabel?: string
  invertDelta?: boolean
  icon?: ReactNode
  trend?: number[]
  colorIndex?: number
  isLoading?: boolean
  footer?: ReactNode
  className?: string
  onClick?: () => void
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  invertDelta = false,
  icon,
  trend,
  colorIndex = 0,
  isLoading,
  footer,
  className,
  onClick,
}: StatCardProps) {
  if (isLoading) {
    return (
      <div className={cn('surface-card p-gutter', className)} aria-busy>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-32" />
        <Skeleton className="mt-2 h-3 w-20" />
      </div>
    )
  }

  const hasDelta = delta != null && Number.isFinite(delta)
  const direction = !hasDelta ? 'flat' : delta > 0.001 ? 'up' : delta < -0.001 ? 'down' : 'flat'
  const isGood = direction === 'flat' ? null : invertDelta ? direction === 'down' : direction === 'up'

  const DeltaIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : ArrowRight

  const color = `var(--color-chart-${colorIndex + 1})`

  return (
    <div
      className={cn(
        'surface-card relative overflow-hidden p-gutter',
        '@container',
        onClick &&
          'cursor-pointer transition-colors pointer-fine:hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {trend && trend.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 opacity-25" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend.map((point, index) => ({ index, point }))}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="point"
                stroke={color}
                strokeWidth={2}
                fill={`url(#spark-${label})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{label}</p>
        {icon && <span className="shrink-0 text-fg-subtle [&_svg]:size-4">{icon}</span>}
      </div>

      <p className="relative mt-2 text-2xl font-semibold tabular tracking-tight text-fg">{value}</p>

      {(hasDelta || deltaLabel) && (
        <div className="relative mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {hasDelta && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium tabular',
                isGood === null && 'text-fg-muted',
                isGood === true && 'text-success',
                isGood === false && 'text-danger',
              )}
            >
              <DeltaIcon className="size-3.5" aria-hidden />
              {formatPercent(Math.abs(delta), { decimals: 1 })}
            </span>
          )}
          {deltaLabel && <span className="text-fg-subtle">{deltaLabel}</span>}
        </div>
      )}

      {footer && <div className="relative mt-3 border-t border-line-subtle pt-3">{footer}</div>}
    </div>
  )
}
