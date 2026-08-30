import { z } from 'zod'

/**
 * THE AGENT → UI CONTRACT
 *
 * Mirrors `backend/src/domain/components/`. Two levels, and the split matters:
 *
 *   container  the only grid-level kind. Occupies one slot of a `size`.
 *   nodes      the parts inside it. Only `button-group` may nest; only
 *              `button` carries an action.
 *
 * The backend already validates all of this. Parsing it again here is not
 * distrust of the backend — it is the boundary that keeps a contract change
 * from surfacing as a blank widget three components deep.
 */

export const ATOMIC_NODE_KINDS = [
  'title',
  'trend-chart',
  'category-chart',
  'breakdown-chart',
  'stat',
  'label',
  'button',
  'button-group',
] as const

export type AtomicNodeKind = (typeof ATOMIC_NODE_KINDS)[number]

export const ACTION_KINDS = ['navigate', 'confirm', 'reject', 'export', 'refresh'] as const
export type ActionKind = (typeof ACTION_KINDS)[number]

export const WIDGET_SIZE_NAMES = [
  'tile',
  'small',
  'wide',
  'tall',
  'tower',
  'large',
  'banner',
] as const
export type WidgetSizeName = (typeof WIDGET_SIZE_NAMES)[number]

export interface ComponentNode {
  kind: string
  order: number
  props: Record<string, unknown>
  action?: string
  children?: ComponentNode[]
}

/**
 * `kind` and `action` stay loose strings on purpose.
 *
 * The agent writes these at runtime and the judges will change the flow live.
 * A strict enum would reject the whole tree over one unrecognised node and the
 * screen would go blank — the renderer degrades a single unknown node to a
 * visible placeholder instead, which is the failure everyone can act on.
 */
export const componentNodeSchema: z.ZodType<ComponentNode> = z.lazy(() =>
  z.object({
    kind: z.string(),
    order: z.number().int().catch(0),
    props: z.record(z.string(), z.unknown()).catch({}),
    action: z.string().optional(),
    children: z.array(componentNodeSchema).optional(),
  }),
)

export const componentSchema = z.object({
  id: z.string(),
  operation_id: z.string(),
  kind: z.string(),
  /** Wire key is `content`; its value is the node tree. */
  content: z.array(componentNodeSchema).catch([]),
  size: z.enum(WIDGET_SIZE_NAMES).catch('small'),
  created_at: z.string(),
})

export type GeneratedComponent = z.infer<typeof componentSchema>

export const layoutEntrySchema = z.object({
  id: z.string().min(1),
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
})

export type LayoutEntry = z.infer<typeof layoutEntrySchema>

export const componentsResponseSchema = z.object({
  components: z.array(componentSchema),
  layout: z.array(layoutEntrySchema).catch([]),
})

export type ComponentsResponse = z.infer<typeof componentsResponseSchema>

/** Sorted copy: `order` is the contract, array position is not. */
export function byOrder(nodes: ComponentNode[]): ComponentNode[] {
  return [...nodes].sort((a, b) => a.order - b.order)
}
