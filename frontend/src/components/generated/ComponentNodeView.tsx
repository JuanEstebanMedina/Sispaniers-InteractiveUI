import type { ReactNode } from 'react'

import { BreakdownChart, CategoryChart, type Series, TrendChart } from '@/components/charts/Charts'
import { cn } from '@/lib/cn'
import type { ComponentNode } from '@/schemas'

/**
 * Un widget ya trae su propia tarjeta y su propia cabecera, así que el marco de
 * los gráficos se neutraliza: si no, quedan dos bordes y dos títulos anidados.
 */
const BARE_FRAME = 'border-0 bg-transparent p-0 shadow-none'

const CHART_HEIGHT = 200

function text(props: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    : []
}

function series(value: unknown): Series[] {
  return rows(value).flatMap((row) =>
    typeof row.key === 'string'
      ? [{ key: row.key, label: typeof row.label === 'string' ? row.label : row.key }]
      : [],
  )
}

function breakdown(value: unknown): { name: string; value: number }[] {
  return rows(value).flatMap((row) =>
    typeof row.name === 'string' && typeof row.value === 'number'
      ? [{ name: row.name, value: row.value }]
      : [],
  )
}

function byOrder(nodes: ComponentNode[]): ComponentNode[] {
  return [...nodes].sort((a, b) => a.order - b.order)
}

function Node({ node }: { node: ComponentNode }): ReactNode {
  const { kind, props } = node

  switch (kind) {
    case 'title':
      return <h4 className="truncate text-xs font-semibold text-fg">{text(props, 'text') ?? ''}</h4>

    case 'label':
      return <p className="text-xs text-fg-muted">{text(props, 'text') ?? ''}</p>

    case 'stat':
      return (
        <div className="flex flex-col justify-center">
          <p className="truncate font-mono text-lg font-semibold tabular text-fg">
            {text(props, 'value') ?? String(props.value ?? '—')}
          </p>
          <p className="mt-0.5 text-2xs text-fg-subtle">{text(props, 'label') ?? ''}</p>
        </div>
      )

    case 'trend-chart':
      return (
        <TrendChart
          data={rows(props.data)}
          xKey={text(props, 'xKey') ?? 'x'}
          series={series(props.series)}
          height={CHART_HEIGHT}
          className={BARE_FRAME}
        />
      )

    case 'category-chart':
      return (
        <CategoryChart
          data={rows(props.data)}
          xKey={text(props, 'xKey') ?? 'x'}
          series={series(props.series)}
          height={CHART_HEIGHT}
          className={BARE_FRAME}
        />
      )

    case 'breakdown-chart':
      return (
        <BreakdownChart
          data={breakdown(props.data)}
          height={CHART_HEIGHT}
          className={BARE_FRAME}
        />
      )

    case 'button':
      // Las acciones del agente todavía no tienen destino en el front: el botón
      // se pinta para que el widget se vea completo, pero no dispara nada.
      return (
        <button
          type="button"
          disabled
          className={cn(
            'rounded-xs border border-line/40 px-2 py-1 text-2xs text-fg-muted',
            'disabled:opacity-60',
          )}
        >
          {text(props, 'text', 'label') ?? node.action ?? ''}
        </button>
      )

    case 'button-group':
      return (
        <div className="flex flex-wrap gap-1.5">
          {byOrder(node.children ?? []).map((child, index) => (
            <Node key={`${child.kind}-${child.order}-${index}`} node={child} />
          ))}
        </div>
      )

    default:
      return null
  }
}

/** Pinta el árbol que escribió el agente dentro del cuerpo de un widget. */
export function ComponentNodeView({ nodes }: { nodes: ComponentNode[] }) {
  return (
    <div className="flex flex-col gap-2">
      {byOrder(nodes).map((node, index) => (
        <Node key={`${node.kind}-${node.order}-${index}`} node={node} />
      ))}
    </div>
  )
}

/** El primer `title` del árbol: el nombre que el agente le puso al widget. */
export function agentTitleOf(nodes: ComponentNode[]): string | undefined {
  const node = byOrder(nodes).find((candidate) => candidate.kind === 'title')
  return node ? text(node.props, 'text') : undefined
}
