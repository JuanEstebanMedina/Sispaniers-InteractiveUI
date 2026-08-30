import type { LayoutEntry, OperationComponent } from '@/schemas'
import { ComponentNodeView, agentTitleOf } from './ComponentNodeView'
import type { Widget } from './WidgetGrid'

/**
 * El backend devuelve dos listas: los componentes en el orden que eligió el
 * usuario y sus coordenadas ya empaquetadas. El grid quiere una sola cosa con
 * ambas, y respeta el orden del array — así que se recorre `components`, no
 * `layout`.
 */
export function toWidgets(
  components: OperationComponent[],
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
        fromAgent: component.title === undefined,
        body: <ComponentNodeView nodes={body} />,
      },
    ]
  })
}
