import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

interface TooltipEntry {
  dataKey?: string | number
  name?: string | number
  value?: number | string
  color?: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  format?: (value: number) => string
  showTotal?: boolean
  labelFormat?: (label: string) => string
}

export function ChartTooltip({
  active,
  payload,
  label,
  format = (value) => formatNumber(value),
  labelFormat,
  showTotal = false,
}: ChartTooltipProps) {
  const { t } = useTranslation()

  if (!active || !payload?.length) return null

  const entries = payload.filter((entry) => entry.value != null)
  const total = entries.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0)

  return (
    <div
      className={cn(
        'min-w-40 rounded-md border border-line bg-surface-raised shadow-lg',
        'px-3 py-2 text-sm',
        'pointer-events-none',
      )}
      role="tooltip"
    >
      {label != null && (
        <p className="mb-2 border-b border-line-subtle pb-2 text-xs font-medium text-fg-muted">
          {labelFormat ? labelFormat(String(label)) : String(label)}
        </p>
      )}

      <ul className="space-y-0.5">
        {entries.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-xs"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              <span className="truncate text-fg-muted">{entry.name}</span>
            </span>
            <span className="shrink-0 tabular font-medium text-fg">
              {format(Number(entry.value))}
            </span>
          </li>
        ))}
      </ul>

      {showTotal && entries.length > 1 && (
        <div className="mt-2 flex items-center justify-between gap-4 border-t border-line-subtle pt-2">
          <span className="text-fg-muted">{t('chart.total')}</span>
          <span className="tabular font-semibold text-fg">{format(total)}</span>
        </div>
      )}
    </div>
  )
}
