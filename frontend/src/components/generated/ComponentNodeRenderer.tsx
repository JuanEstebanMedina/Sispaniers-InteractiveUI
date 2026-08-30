import type { ReactNode } from 'react'

import { WIDGET_SIZES } from '@/lib/grid'
import { byOrder, type ComponentNode, type GeneratedComponent } from '@/schemas/component.schema'
import type { Widget } from './WidgetGrid'

/**
 * LO QUE ESCRIBE EL AGENTE, PINTADO
 *
 * El backend valida el ÁRBOL (kinds permitidos, profundidad, que sólo `button`
 * lleve acción) pero **no valida `props`**: en el dominio es
 * `Record<string, unknown>` y el prompt del agente lo deja literalmente como
 * `{ ... }`. Así que acá no se puede asumir una forma; se leen varias claves
 * plausibles y se cae con gracia.
 *
 * La regla que gobierna este archivo: **un nodo raro no puede dejar la pantalla
 * en blanco.** Durante el run el jurado va a cambiar el flujo en vivo; si el
 * agente inventa un `kind`, se pinta un marcador visible —que alguien puede
 * leer y reportar— en vez de reventar el árbol entero.
 */

/* --------------------------------------------------------------------------
 * Lectura defensiva de props
 * ----------------------------------------------------------------------- */

function str(props: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = props[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return null
}

interface Point {
  label: string
  value: number
}

/** Acepta `[{label,value}]`, `[{name,y}]` o `[1,2,3]`. */
function points(props: Record<string, unknown>): Point[] {
  const raw = props.data ?? props.points ?? props.series ?? props.values
  if (!Array.isArray(raw)) return []

  return raw.flatMap((entry, index): Point[] => {
    if (typeof entry === 'number') return [{ label: String(index + 1), value: entry }]
    if (typeof entry !== 'object' || entry === null) return []

    const record = entry as Record<string, unknown>
    const value = record.value ?? record.y ?? record.count
    if (typeof value !== 'number') return []

    return [{ label: str(record, 'label', 'name', 'x') ?? String(index + 1), value }]
  })
}

/* --------------------------------------------------------------------------
 * Piezas
 * ----------------------------------------------------------------------- */

function Bars({ data, horizontal }: { data: Point[]; horizontal?: boolean }) {
  if (data.length === 0) return <Missing what="datos" />

  const max = Math.max(...data.map((point) => point.value), 1)

  if (horizontal) {
    return (
      <ul className="flex flex-col gap-1">
        {data.slice(0, 6).map((point) => (
          <li key={point.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-2xs text-fg-subtle">{point.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${(point.value / max) * 100}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-2xs tabular text-fg-muted">
              {point.value}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex h-full items-end gap-1">
      {data.slice(0, 12).map((point) => (
        <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span
            className="w-full rounded-t bg-accent"
            style={{ height: `${Math.max((point.value / max) * 100, 4)}%` }}
            title={`${point.label}: ${point.value}`}
          />
          <span className="w-full truncate text-center text-2xs text-fg-subtle">{point.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Ausencia declarada, no silencio: se ve que el agente mandó algo incompleto. */
function Missing({ what }: { what: string }) {
  return <p className="text-2xs italic text-fg-subtle">Sin {what}</p>
}

function Unknown({ kind }: { kind: string }) {
  return (
    <p className="rounded border border-dashed border-border px-2 py-1 font-mono text-2xs text-fg-subtle">
      {kind}?
    </p>
  )
}

/* --------------------------------------------------------------------------
 * El nodo
 * ----------------------------------------------------------------------- */

function NodeView({ node, depth = 0 }: { node: ComponentNode; depth?: number }) {
  const { props } = node

  switch (node.kind) {
    case 'title':
      return (
        <p className="truncate text-sm font-semibold text-fg">
          {str(props, 'text', 'title', 'value') ?? '—'}
        </p>
      )

    case 'label':
      return (
        <p className="text-xs text-fg-muted">{str(props, 'text', 'label', 'value') ?? '—'}</p>
      )

    case 'stat':
      return (
        <div className="flex flex-col justify-center">
          <p className="truncate font-mono text-lg font-semibold tabular text-fg">
            {str(props, 'value', 'text') ?? '—'}
          </p>
          <p className="mt-0.5 truncate text-2xs text-fg-subtle">
            {str(props, 'label', 'caption') ?? ''}
          </p>
        </div>
      )

    case 'trend-chart':
    case 'category-chart':
      return (
        <div className="h-24">
          <Bars data={points(props)} />
        </div>
      )

    case 'breakdown-chart':
      return <Bars data={points(props)} horizontal />

    case 'button':
      // Sin `onClick`: las acciones (`confirm`, `reject`, `export`…) todavía no
      // tienen endpoint. Un botón que no hace nada al pulsarlo es peor que uno
      // que se anuncia inerte, así que va deshabilitado y con su acción a la
      // vista hasta que exista a dónde mandarla.
      return (
        <button
          type="button"
          disabled
          title={node.action ? `acción: ${node.action}` : undefined}
          className="rounded-md border border-border px-2 py-1 text-2xs font-medium text-fg-muted disabled:opacity-70"
        >
          {str(props, 'label', 'text') ?? node.action ?? 'acción'}
        </button>
      )

    case 'button-group':
      return (
        <div className="flex flex-wrap gap-1">
          {byOrder(node.children ?? []).map((child, index) => (
            <NodeView key={`${child.kind}-${child.order}-${index}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )

    default:
      return <Unknown kind={node.kind} />
  }
}

/* --------------------------------------------------------------------------
 * Componente → Widget
 * ----------------------------------------------------------------------- */

/**
 * El primer `title` del árbol sube a ser el título del widget, porque el marco
 * del widget ya dibuja una cabecera: dejarlo dentro lo pintaría dos veces.
 */
function splitTitle(nodes: ComponentNode[]): { title: string | null; rest: ComponentNode[] } {
  const index = nodes.findIndex((node) => node.kind === 'title')
  if (index === -1) return { title: null, rest: nodes }

  const node = nodes[index]
  const title = node ? str(node.props, 'text', 'title', 'value') : null

  return { title, rest: nodes.filter((_, position) => position !== index) }
}

export function ComponentBody({ component }: { component: GeneratedComponent }) {
  const { rest } = splitTitle(byOrder(component.content))

  if (rest.length === 0) return <Missing what="contenido" />

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      {rest.map((node, index) => (
        <NodeView key={`${node.kind}-${node.order}-${index}`} node={node} />
      ))}
    </div>
  )
}

/**
 * Posiciones de salida, no de entrada: el empacador de la grilla las recoloca.
 * Arrancan en una fila alta para que los widgets del agente caigan DESPUÉS de
 * los fijos en vez de empujarlos hacia abajo cada vez que llega uno nuevo.
 */
const AGENT_ROW_OFFSET = 100

export function toAiWidgets(components: GeneratedComponent[]): Widget[] {
  return components.map((component, index) => {
    const { title } = splitTitle(byOrder(component.content))

    return {
      id: component.id,
      ...WIDGET_SIZES[component.size],
      col: 0,
      row: AGENT_ROW_OFFSET + index,
      title: title ?? component.kind,
      fromAgent: true,
      body: <ComponentBody component={component} /> as ReactNode,
    }
  })
}
