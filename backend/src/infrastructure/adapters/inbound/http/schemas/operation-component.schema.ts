import { z } from "zod";

export const gridColsSchema = z.union([z.literal(2), z.literal(4), z.literal(8)]);

export const layoutEntrySchema = z.object({
  id: z.string().min(1),
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  w: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  h: z.number().int().min(1),
});

/**
 * Widgets can be moved but never resized, so `w`/`h` are accepted for wire
 * compatibility and then ignored: the size comes from the component itself.
 */
export const layoutPositionSchema = z
  .object({
    id: z.string().min(1),
    col: z.number().int().min(0),
    row: z.number().int().min(0),
    w: z.number().int().min(1).optional(),
    h: z.number().int().min(1).optional(),
  })
  .transform(({ id, col, row }) => ({ id, col, row }));

export const componentResponseSchema = z.object({
  id: z.string(),
  operation_id: z.string(),
  kind: z.string(),
  content: z.record(z.unknown()),
  size: z.string(),
  created_at: z.string(),
});

export const getComponentsQuerySchema = z.object({
  cols: z.coerce.number().pipe(gridColsSchema),
});

export const getComponentsResponseSchema = z.object({
  components: z.array(componentResponseSchema),
  layout: z.array(layoutEntrySchema),
});

export const updateLayoutBodySchema = z.object({
  cols: gridColsSchema,
  layout: z.array(layoutPositionSchema),
});

export const updateLayoutResponseSchema = z.object({
  cols: gridColsSchema,
  layout: z.array(layoutEntrySchema),
});

export const updateComponentContentBodySchema = z.object({
  content: z.record(z.unknown()),
});

export const updateComponentContentResponseSchema = componentResponseSchema;
