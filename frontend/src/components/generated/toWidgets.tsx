import { byOrder, type ComponentNode, type GeneratedComponent, type LayoutEntry } from '@/schemas'
import { createTree } from './nodeFactory'
import type { Widget } from './WidgetGrid'

/**
 * The agent's tree, turned into what the grid draws.
 *
 * Rendering goes through `nodeFactory`, which is the only place that knows the
 * whole contract: a kind missing from here would silently paint an empty
 * widget, and on a supervision screen that is indistinguishable from good news.
 */

interface Heading {
  title?: string
  rest: ComponentNode[]
}

/**
 * The widget frame already draws a header, so the first `title` of the tree
 * moves up into it and leaves the body. It is pulled from wherever it sits:
 * the agent is free to nest it inside a layout, and a header reading "—" over
 * a title the reader can plainly see is the worse of the two failures.
 */
function liftTitle(nodes: ComponentNode[]): Heading {
  const rest: ComponentNode[] = []
  let title: string | undefined

  for (const node of byOrder(nodes)) {
    if (title === undefined && node.kind === 'title') {
      const text = node.props.text
      title = typeof text === 'string' ? text : ''
      continue
    }

    if (title === undefined && node.children?.length) {
      const inner = liftTitle(node.children)
      title = inner.title
      rest.push({ ...node, children: inner.rest })
      continue
    }

    rest.push(node)
  }

  return { title, rest }
}

export function toWidgets(components: GeneratedComponent[], layout: LayoutEntry[]): Widget[] {
  const placement = new Map(layout.map((entry) => [entry.id, entry]))

  return components.flatMap((component) => {
    const at = placement.get(component.id)
    if (!at) return []

    const { title, rest } = liftTitle(component.content)

    return [
      {
        id: component.id,
        col: at.col,
        row: at.row,
        w: at.w,
        h: at.h,
        title: component.title ?? title ?? '—',
        priority: component.priority,
        fromAgent: component.title === undefined,
        // Parts that ask to fill the widget (`flex-1`, `h-full`) only get to —
        // a chart's `flex-1` does nothing inside a bare Fragment, it needs a
        // flex ancestor to grow against.
        body: (
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
            {createTree(rest, component.id)}
          </div>
        ),
      },
    ]
  })
}
