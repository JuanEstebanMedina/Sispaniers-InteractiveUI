export const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
] as const

export function seriesColor(index: number): string {
  return CHART_COLORS[index] ?? 'var(--color-fg-subtle)'
}

export const STATUS_COLORS = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  neutral: 'var(--color-fg-subtle)',
} as const

export const axisProps = {
  stroke: 'var(--color-chart-axis)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--color-fg-subtle)', fontSize: 11 },
} as const

export const gridProps = {
  stroke: 'var(--color-chart-grid)',
  strokeDasharray: '0',
  vertical: false,
} as const

export const cursorProps = {
  fill: 'var(--color-surface-hover)',
  stroke: 'var(--color-line-strong)',
} as const

export const MARK = {
  strokeWidth: 2,
  dotRadius: 4,
  activeDotRadius: 5,
  barRadius: 4,
  gap: 2,
} as const
