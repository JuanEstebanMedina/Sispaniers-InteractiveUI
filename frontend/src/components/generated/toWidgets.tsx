import type { ComponentNode, GeneratedComponent, LayoutEntry } from '@/schemas'
import { createTree } from './nodeFactory'
import type { Widget } from './WidgetGrid'

/** El primer `title` del árbol: el nombre que el agente le puso al widget. */
function agentTitleOf(nodes: ComponentNode[]): string | undefined {
  const node = nodes.find((candidate) => candidate.kind === 'title')
  const text = node?.props.text
  return typeof text === 'string' && text.length > 0 ? text : undefined
}

/**
 * El backend devuelve dos listas: los componentes en el orden que eligió el
 * usuario y sus coordenadas ya empaquetadas. El grid quiere una sola cosa con
 * ambas, y respeta el orden del array — así que se recorre `components`, no
 * `layout`.
 */
export function toWidgets(
  components: GeneratedComponent[],
  layout: LayoutEntry[],
): Widget[] {
  const placement = new Map(layout.map((entry) => [entry.id, entry]))

  return components.flatMap((component) => {
    const at = placement.get(component.id)
    if (!at) return []

    const agentTitle = agentTitleOf(component.content)
    // El título va en la cabecera del widget; dejarlo también en el cuerpo lo
    // pintaría dos veces.
    const body = component.content.filter((node) => node.kind !== 'title')

    return [
      {
        id: component.id,
        col: at.col,
        row: at.row,
        w: at.w,
        h: at.h,
        title: component.title ?? agentTitle ?? '—',
        priority: component.priority,
        fromAgent: component.title === undefined,
        // Parts that ask to fill the widget (`flex-1`, `h-full`) only get to —
        // a chart's `flex-1` does nothing inside a bare Fragment, it needs a
        // flex ancestor to grow against.
        body: (
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
            {createTree(body, component.id)}
          </div>
        ),
      },
    ]
  })
}
