import type { ReactNode } from 'react'

import { BreakdownChart, CategoryChart, TrendChart, type Series } from '@/components/charts/Charts'
import { cn } from '@/lib/cn'
import { useDataset } from './ComponentData'

/**
 * THE BASIC PARTS
 *
 * Every one of these is an ordinary React component with plain, typed props.
 * They know nothing about the agent, the node tree or `Record<string, unknown>`
 * — the factory hands them clean props and they render.
 *
 * That is what makes them usable by hand:
 *
 *   <Part.Layout direction="row" gap="sm">
 *     <Part.Title text="Ventas" />
 *     <Part.Button action="refresh" label="Mes" />
 *   </Part.Layout>
 *
 * and testable without a single line of JSON.
 */

export type Direction = 'row' | 'column'
export type Gap = 'none' | 'xs' | 'sm' | 'md' | 'lg'
export type Align = 'start' | 'center' | 'end' | 'stretch'
export type Justify = 'start' | 'center' | 'end' | 'between'
export type Tone = 'default' | 'muted' | 'agent' | 'accent'

/**
 * Design-system values only. The agent picks a name from a closed list, never a
 * raw length — a `gap: "37px"` cannot reach the DOM, so a generated screen
 * cannot drift off the spacing rhythm.
 */
const GAPS: Record<Gap, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
}

const ALIGNS: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

const JUSTIFIES: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
}

const TONES: Record<Tone, string> = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  agent: 'text-agent',
  accent: 'text-accent',
}

export function Layout({
  direction = 'column',
  gap = 'sm',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  children,
}: {
  direction?: Direction
  gap?: Gap
  align?: Align
  justify?: Justify
  wrap?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-w-0',
        direction === 'row' ? 'flex-row' : 'flex-col',
        GAPS[gap],
        ALIGNS[align],
        JUSTIFIES[justify],
        wrap && 'flex-wrap',
      )}
    >
      {children}
    </div>
  )
}

export function Title({ text, tone = 'default' }: { text: string; tone?: Tone }) {
  return (
    <h4 className={cn('truncate font-display text-sm font-semibold tracking-tight', TONES[tone])}>
      {text}
    </h4>
  )
}

export function Label({ text, tone = 'muted' }: { text: string; tone?: Tone }) {
  return <p className={cn('text-pretty text-xs', TONES[tone])}>{text}</p>
}

export function Stat({
  value,
  label,
  tone = 'default',
}: {
  value: string
  label?: string
  tone?: Tone
}) {
  return (
    <div className="min-w-0">
      <p className={cn('truncate font-mono text-lg font-semibold tabular', TONES[tone])}>{value}</p>
      {label && <p className="mt-0.5 truncate text-2xs text-fg-subtle">{label}</p>}
    </div>
  )
}

/**
 * Rendered, and deliberately inert.
 *
 * The action vocabulary exists on both sides but nothing is wired to it yet.
 * A button that looks live and does nothing is worse in a supervision console
 * than one that plainly says it is not ready, so it stays disabled and says so
 * on hover.
 */
export function Button({ label, action }: { label: string; action: string }) {
  return (
    <button
      type="button"
      disabled
      title={`${action} — sin conectar`}
      className={cn(
        'inline-flex h-control-sm shrink-0 items-center rounded-md px-3',
        'border border-line bg-surface text-xs font-medium text-fg-muted',
        'cursor-not-allowed opacity-60',
      )}
    >
      {label}
    </button>
  )
}

interface ChartPartProps {
  dataKey?: string
  title?: string
  xKey?: string
  series?: Series[]
}

export function Trend({ dataKey, title, xKey = 'x', series = [] }: ChartPartProps) {
  const data = useDataset(dataKey)
  return (
    <TrendChart
      title={title}
      data={data}
      xKey={xKey}
      series={series}
      height={180}
    />
  )
}

export function Category({ dataKey, title, xKey = 'x', series = [] }: ChartPartProps) {
  const data = useDataset(dataKey)
  return (
    <CategoryChart
      title={title}
      data={data}
      xKey={xKey}
      series={series}
      height={180}
    />
  )
}

export function Breakdown({ dataKey, title }: { dataKey?: string; title?: string }) {
  const rows = useDataset(dataKey)
  return (
    <BreakdownChart
      title={title}
      data={rows as { name: string; value: number }[] | undefined}
      height={180}
    />
  )
}

/** What a `kind` with no builder registered falls back to. */
export function Unknown({ kind, node }: { kind: string; node: unknown }) {
  return (
    <details className="rounded-md border border-dashed border-line-strong bg-surface-sunken p-2">
      <summary className="cursor-pointer text-2xs text-fg-muted">
        Componente desconocido: <code className="font-mono text-fg">{kind}</code>
      </summary>
      <pre className="mt-2 overflow-x-auto text-2xs text-fg-subtle">
        {JSON.stringify(node, null, 2)}
      </pre>
    </details>
  )
}
