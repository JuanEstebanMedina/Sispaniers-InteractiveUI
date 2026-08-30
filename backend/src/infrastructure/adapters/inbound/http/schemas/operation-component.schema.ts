import { z } from "zod";
import { WIDGET_SIZES, type WidgetSizeName } from "../../../../../domain/components/widget-size.js";
import { GRID_COMPONENT_KINDS } from "../../../../../domain/enums/widget-kind.js";
import { componentChildrenSchema } from "./component-node.schema.js";

const widgetSizeNames = Object.keys(WIDGET_SIZES) as [WidgetSizeName, ...WidgetSizeName[]];

export const widgetSizeSchema = z.enum(widgetSizeNames);
export const gridComponentKindSchema = z.enum(GRID_COMPONENT_KINDS);

export const gridColsSchema = z.union([z.literal(2), z.literal(4), z.literal(8)]);

export const layoutEntrySchema = z.object({
  id: z.string().min(1),
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  w: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  h: z.number().int().min(1),
});

// Wire-level key stays "content" for backward compatibility with the already
// shipped flow-components contract (SPEC-FC-007); its value is now the
// ComponentNode[] tree (children) rather than an opaque bag.
export const componentResponseSchema = z.object({
  id: z.string(),
  operation_id: z.string(),
  kind: z.string(),
  content: z.array(z.unknown()),
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

export const updateComponentContentBodySchema = z.union([
  z.object({ content: componentChildrenSchema }).strict(),
  z.object({ path: z.string().min(1), value: z.unknown() }).strict(),
]);

// A widget can be moved and renamed, never resized: position is an index in the
// operation's sequence, and the grid coordinates are packed from it.
export const updateComponentPlacementBodySchema = z
  .object({
    position: z.number().int().min(0).optional(),
    title: z.string().max(120).optional(),
  })
  .strict()
  .refine(
    (body) => body.position !== undefined || body.title !== undefined,
    "at least one of position or title is required",
  );

export const updateComponentContentResponseSchema = componentResponseSchema;

export const createComponentBodySchema = z.object({
  kind: gridComponentKindSchema,
  size: widgetSizeSchema,
  children: componentChildrenSchema,
});
