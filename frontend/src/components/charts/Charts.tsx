import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { axisProps, cursorProps, gridProps, MARK, seriesColor } from './chartTheme'
import { ChartTooltip } from './ChartTooltip'

export interface Series {
  key: string
  label: string
  colorIndex?: number
}

interface ChartFrameProps {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  height?: number
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
  isEmpty?: boolean
  emptyMessage?: string
  children: ReactNode
  className?: string
  tableView?: ReactNode
}

export function ChartFrame({
  title,
  description,
  action,
  height = 260,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyMessage,
  children,
  className,
  tableView,
}: ChartFrameProps) {
  const { t } = useTranslation()
  const [showTable, setShowTable] = useState(false)

  return (
    <section className={cn('surface-card flex flex-col', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-gutter py-4">
          <div className="min-w-0">
            {title && <h3 className="text-lg font-semibold leading-tight text-fg">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {tableView && (
              <button
                type="button"
                onClick={() => setShowTable((value) => !value)}
                className="rounded-xs text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {showTable ? t('actions.seeChart') : t('actions.seeData')}
              </button>
            )}
          </div>
        </header>
      )}

      <div className="min-w-0 flex-1 px-gutter pb-gutter">
        {error ? (
          <ErrorState compact error={error} onRetry={onRetry} />
        ) : isLoading ? (
          <Skeleton className="w-full rounded-md" style={{ height }} />
        ) : isEmpty ? (
          <EmptyState
            compact
            variant="no-results"
            title={t('chart.noDataForPeriod')}
            description={emptyMessage ?? t('chart.noDataHint')}
          />
        ) : showTable && tableView ? (
          <div className="scroll-x" style={{ maxHeight: height }}>
            {tableView}
          </div>
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </div>
    </section>
  )
}

function renderLegend(series: Series[]) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3 text-xs">
      {series.map((item, index) => (
        <li key={item.key} className="flex items-center gap-2">
          <span
            className="size-2 rounded-xs"
            style={{ backgroundColor: seriesColor(item.colorIndex ?? index) }}
            aria-hidden
          />
          <span className="text-fg-muted">{item.label}</span>
        </li>
      ))}
    </ul>
  )
}

interface TrendChartProps extends Omit<ChartFrameProps, 'children' | 'isEmpty'> {
  data: Record<string, unknown>[] | undefined
  xKey: string
  series: Series[]
  variant?: 'line' | 'area'
  stacked?: boolean
  format?: (value: number) => string
  xFormat?: (value: string) => string
}

export function TrendChart({
  data,
  xKey,
  series,
  variant = 'area',
  stacked = false,
  format = (value) => formatNumber(value),
  xFormat,
  height = 260,
  ...frame
}: TrendChartProps) {
  const rows = data ?? []

  return (
    <ChartFrame {...frame} height={height} isEmpty={rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        {variant === 'area' ? (
          <AreaChart data={rows} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <defs>
              {series.map((item, index) => {
                const color = seriesColor(item.colorIndex ?? index)
                return (
                  <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                )
              })}
            </defs>

            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormat} minTickGap={24} />
            <YAxis {...axisProps} tickFormatter={(value) => format(Number(value))} width={56} />
            <Tooltip
              content={<ChartTooltip format={format} labelFormat={xFormat} showTotal={stacked} />}
              cursor={{ stroke: cursorProps.stroke, strokeWidth: 1 }}
            />
            {series.length > 1 && <Legend content={() => renderLegend(series)} />}

            {series.map((item, index) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stackId={stacked ? 'stack' : undefined}
                stroke={seriesColor(item.colorIndex ?? index)}
                strokeWidth={MARK.strokeWidth}
                fill={`url(#fill-${item.key})`}
                dot={false}
                activeDot={{ r: MARK.activeDotRadius, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                connectNulls={false}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={rows} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormat} minTickGap={24} />
            <YAxis {...axisProps} tickFormatter={(value) => format(Number(value))} width={56} />
            <Tooltip
              content={<ChartTooltip format={format} labelFormat={xFormat} />}
              cursor={{ stroke: cursorProps.stroke, strokeWidth: 1 }}
            />
            {series.length > 1 && <Legend content={() => renderLegend(series)} />}

            {series.map((item, index) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={seriesColor(item.colorIndex ?? index)}
                strokeWidth={MARK.strokeWidth}
                dot={false}
                activeDot={{ r: MARK.activeDotRadius, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </ChartFrame>
  )
}

interface CategoryChartProps extends Omit<ChartFrameProps, 'children' | 'isEmpty'> {
  data: Record<string, unknown>[] | undefined
  xKey: string
  series: Series[]
  stacked?: boolean
  horizontal?: boolean
  format?: (value: number) => string
}

export function CategoryChart({
  data,
  xKey,
  series,
  stacked = false,
  horizontal = false,
  format = (value) => formatNumber(value),
  height = 260,
  ...frame
}: CategoryChartProps) {
  const rows = data ?? []

  return (
    <ChartFrame {...frame} height={height} isEmpty={rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 4, right: 8, left: horizontal ? 8 : -12, bottom: 0 }}
          barCategoryGap={horizontal ? '20%' : '24%'}
          barGap={MARK.gap}
        >
          <CartesianGrid {...gridProps} vertical={horizontal} horizontal={!horizontal} />

          {horizontal ? (
            <>
              <XAxis type="number" {...axisProps} tickFormatter={(value) => format(Number(value))} />
              <YAxis type="category" dataKey={xKey} {...axisProps} width={120} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(value) => format(Number(value))} width={56} />
            </>
          )}

          <Tooltip content={<ChartTooltip format={format} showTotal={stacked} />} cursor={cursorProps} />
          {series.length > 1 && <Legend content={() => renderLegend(series)} />}

          {series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              stackId={stacked ? 'stack' : undefined}
              fill={seriesColor(item.colorIndex ?? index)}
              radius={
                horizontal ? [0, MARK.barRadius, MARK.barRadius, 0] : [MARK.barRadius, MARK.barRadius, 0, 0]
              }
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

interface BreakdownDatum {
  name: string
  value: number
  color?: string
}

interface BreakdownChartProps extends Omit<ChartFrameProps, 'children' | 'isEmpty'> {
  data: BreakdownDatum[] | undefined
  format?: (value: number) => string
  centerLabel?: string
  centerValue?: ReactNode
}

export function BreakdownChart({
  data,
  format = (value) => formatNumber(value),
  centerLabel,
  centerValue,
  height = 260,
  ...frame
}: BreakdownChartProps) {
  const { t } = useTranslation()
  const rows = data ?? []

  const top = rows.slice(0, 6)
  const rest = rows.slice(6)
  const slices =
    rest.length > 0
      ? [...top, { name: t('chart.other'), value: rest.reduce((sum, item) => sum + item.value, 0) }]
      : top

  const total = slices.reduce((sum, item) => sum + item.value, 0)

  return (
    <ChartFrame {...frame} height={height} isEmpty={rows.length === 0}>
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={1.5}
              strokeWidth={2}
              stroke="var(--color-surface)"
            >
              {slices.map((slice, index) => (
                <Cell
                  key={slice.name}
                  fill={slice.color ?? seriesColor(index)}
                />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  format={(value) =>
                    `${format(value)} · ${((value / total) * 100).toFixed(1)}%`
                  }
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>

        {(centerLabel || centerValue) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && (
              <span className="text-2xl font-semibold tabular tracking-tight text-fg">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-xs uppercase tracking-wide text-fg-muted">{centerLabel}</span>
            )}
          </div>
        )}
      </div>

      <ul className="mt-3 space-y-0.5 text-xs">
        {slices.map((slice, index) => (
          <li key={slice.name} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-xs"
                style={{ backgroundColor: slice.color ?? seriesColor(index) }}
                aria-hidden
              />
              <span className="truncate text-fg-muted">{slice.name}</span>
            </span>
            <span className="shrink-0 tabular text-fg">
              {format(slice.value)}
              <span className="ml-2 text-fg-subtle">
                {total ? `${((slice.value / total) * 100).toFixed(0)}%` : '—'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  )
}
