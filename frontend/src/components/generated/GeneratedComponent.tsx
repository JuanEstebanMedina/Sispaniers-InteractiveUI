import { WIDGET_SIZES, type WidgetSize } from '@/lib/grid'
import type { GeneratedComponent as ComponentDto } from '@/schemas/component.schema'
import type { Widget } from './WidgetGrid'
import { createTree } from './nodeFactory'

/**
 * Renders the node tree of one container.
 *
 * The container itself contributes no chrome: the widget frame around it —
 * card, header, drag handle — already belongs to `WidgetGrid`. All this does is
 * stack the parts the agent asked for.
 */
export function GeneratedComponentBody({ component }: { component: ComponentDto }) {
  return <div className="flex min-w-0 flex-col gap-2">{createTree(component.content)}</div>
}

/**
 * A container becomes a grid widget: its `size` resolves to the same `w`/`h`
 * catalogue the backend validates against, so the two never drift.
 */
export function toWidget(component: ComponentDto, title: string): Widget {
  const size = WIDGET_SIZES[component.size as WidgetSize] ?? WIDGET_SIZES.small

  return {
    id: component.id,
    ...size,
    col: 0,
    row: 0,
    title,
    fromAgent: true,
    body: <GeneratedComponentBody component={component} />,
  }
}
