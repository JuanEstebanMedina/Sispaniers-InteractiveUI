import { z } from 'zod'

/**
 * Un nodo del árbol que escribe el agente. `props` queda sin tipar a propósito:
 * cada `kind` lee las suyas y una prop que falte se resuelve con un valor por
 * defecto, porque el árbol lo genera un modelo y no un compilador.
 */
export interface ComponentNode {
  kind: string
  order: number
  props: Record<string, unknown>
  action?: string
  children?: ComponentNode[]
}

export const componentNodeSchema: z.ZodType<ComponentNode> = z.lazy(() =>
  z.object({
    kind: z.string(),
    order: z.number(),
    props: z.record(z.string(), z.unknown()),
    action: z.string().optional(),
    children: z.array(componentNodeSchema).optional(),
  }),
)

export const layoutEntrySchema = z.object({
  id: z.string(),
  col: z.number(),
  row: z.number(),
  w: z.number(),
  h: z.number(),
})

export const componentSchema = z.object({
  id: z.string(),
  operation_id: z.string(),
  kind: z.string(),
  /** El nombre que escribió el usuario encima del que generó el agente. */
  title: z.string().optional(),
  content: z.array(componentNodeSchema),
  size: z.string(),
  created_at: z.string(),
})

export const operationComponentsSchema = z.object({
  components: z.array(componentSchema),
  layout: z.array(layoutEntrySchema),
})

export type OperationComponent = z.infer<typeof componentSchema>
export type LayoutEntry = z.infer<typeof layoutEntrySchema>
export type OperationComponents = z.infer<typeof operationComponentsSchema>
