import { Fragment, type ReactElement, type ReactNode } from 'react'

import type { Series } from '@/components/charts/Charts'
import { byOrder, type ComponentNode } from '@/schemas/component.schema'
import * as Part from './parts'

/**
 * THE NODE FACTORY
 *
 * No switch over `kind` anywhere. Each part registers a builder, and the
 * factory looks one up. Adding a kind is a `registerNode` call at the bottom of
 * this file and a part in `parts.tsx` — no branch to edit, nothing else to
 * remember.
 *
 * The builders are also the single place the agent's JSON is distrusted. They
 * turn `Record<string, unknown>` into typed props with defaults, so every part
 * receives values it can rely on and can be used by hand without defending
 * itself against anything.
 */

export type NodeBuilder = (node: ComponentNode, children: ReactNode) => ReactElement

const builders = new Map<string, NodeBuilder>()

export function registerNode(kind: string, build: NodeBuilder): void {
  builders.set(kind, build)
}

/* --- prop sanitisers ---------------------------------------------------- */

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const bool = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback

/** Narrows to one of a closed list, or the default. An off-list value never lands. */
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

const DIRECTIONS = ['row', 'column'] as const
const GAPS = ['none', 'xs', 'sm', 'md', 'lg'] as const
const ALIGNS = ['start', 'center', 'end', 'stretch'] as const
const JUSTIFIES = ['start', 'center', 'end', 'between'] as const
const TONES = ['default', 'muted', 'agent', 'accent'] as const

/**
 * Series describe which columns of a dataset to draw. Anything malformed is
 * dropped rather than passed on: recharts renders a broken axis for a series
 * with no key, and a broken axis reads as real data.
 */
function toSeries(value: unknown): Series[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const record = item as Record<string, unknown>
    const key = str(record.key)
    if (!key) return []
    return [{ key, label: str(record.label, key), colorIndex: Number(record.colorIndex) || 0 }]
  })
}

/* --- the registry ------------------------------------------------------- */

registerNode('layout', (node, children) => (
  <Part.Layout
    direction={oneOf(node.props.direction, DIRECTIONS, 'column')}
    gap={oneOf(node.props.gap, GAPS, 'sm')}
    align={oneOf(node.props.align, ALIGNS, 'stretch')}
    justify={oneOf(node.props.justify, JUSTIFIES, 'start')}
    wrap={bool(node.props.wrap)}
  >
    {children}
  </Part.Layout>
))

registerNode('title', (node) => (
  <Part.Title text={str(node.props.text)} tone={oneOf(node.props.tone, TONES, 'default')} />
))

registerNode('label', (node) => (
  <Part.Label text={str(node.props.text)} tone={oneOf(node.props.tone, TONES, 'muted')} />
))

registerNode('stat', (node) => (
  <Part.Stat
    value={str(node.props.value, '—')}
    label={str(node.props.label) || undefined}
    tone={oneOf(node.props.tone, TONES, 'default')}
  />
))

registerNode('button', (node) => (
  <Part.Button label={str(node.props.label, 'Acción')} action={str(node.action, 'navigate')} />
))

registerNode('trend-chart', (node) => (
  <Part.Trend
    dataKey={str(node.props.dataKey) || undefined}
    title={str(node.props.title) || undefined}
    xKey={str(node.props.xKey, 'x')}
    series={toSeries(node.props.series)}
  />
))

registerNode('category-chart', (node) => (
  <Part.Category
    dataKey={str(node.props.dataKey) || undefined}
    title={str(node.props.title) || undefined}
    xKey={str(node.props.xKey, 'x')}
    series={toSeries(node.props.series)}
  />
))

registerNode('breakdown-chart', (node) => (
  <Part.Breakdown
    dataKey={str(node.props.dataKey) || undefined}
    title={str(node.props.title) || undefined}
  />
))

/* --- building ----------------------------------------------------------- */

/**
 * Builds one node, recursing into its children first.
 *
 * A kind with no builder falls back to a visible placeholder instead of
 * throwing. The agent invents nodes at runtime and the judges change the flow
 * live: one unrecognised node has to cost one card, never the screen.
 */
export function createNode(node: ComponentNode, key: string): ReactElement {
  const build = builders.get(node.kind)
  if (!build) return <Part.Unknown key={key} kind={node.kind} node={node} />

  const children = node.children?.length ? createTree(node.children, key) : null
  // The key belongs to the list, not to the part, so a Fragment carries it and
  // builders stay free of key plumbing. It adds no DOM.
  return <Fragment key={key}>{build(node, children)}</Fragment>
}

/** `order` is the contract; array position is not. */
export function createTree(nodes: ComponentNode[], prefix = 'n'): ReactNode[] {
  return byOrder(nodes).map((node, index) => createNode(node, `${prefix}.${index}`))
}
