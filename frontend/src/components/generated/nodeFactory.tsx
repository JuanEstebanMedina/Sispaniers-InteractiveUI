import type { ComponentType, ReactElement, ReactNode } from 'react'

import { byOrder, type ComponentNode } from '@/schemas/component.schema'
import { NodeProvider } from './NodeContext'
import * as Part from './parts'

type PartComponent = ComponentType<{ children?: ReactNode }>

const parts = new Map<string, PartComponent>()

export function registerNode(kind: string, part: PartComponent): void {
  parts.set(kind, part)
}

registerNode('layout', Part.Layout)
registerNode('title', Part.Title)
registerNode('label', Part.Label)
registerNode('stat', Part.Stat)
registerNode('button', Part.Button)
registerNode('trend-chart', Part.Trend)
registerNode('category-chart', Part.Category)
registerNode('breakdown-chart', Part.Breakdown)
registerNode('badge', Part.StatusBadge)
registerNode('divider', Part.Divider)
registerNode('key-values', Part.KeyValues)
registerNode('table', Part.DataTable)
registerNode('timeline', Part.Timeline)
registerNode('progress', Part.Progress)
registerNode('sparkline', Part.Sparkline)
registerNode('file', Part.FileCard)

export function createNode(node: ComponentNode, key: string): ReactElement {
  const Component = parts.get(node.kind) ?? Part.Unknown
  const children = node.children?.length ? createTree(node.children, key) : null

  return (
    <NodeProvider key={key} node={node}>
      <Component>{children}</Component>
    </NodeProvider>
  )
}

/** `order` is the contract; array position is not. */
export function createTree(nodes: ComponentNode[], prefix = 'n'): ReactNode[] {
  return byOrder(nodes).map((node, index) => createNode(node, `${prefix}.${index}`))
}
