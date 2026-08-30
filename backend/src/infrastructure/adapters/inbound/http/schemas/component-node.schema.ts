import { z } from "zod";
import type { ComponentNode } from "../../../../../domain/components/component-node.js";
import { validateComponentTree } from "../../../../../domain/components/component-node.js";
import { InvalidComponentTreeError } from "../../../../../domain/model/errors.js";

// Structural shape only — kind whitelist, leaf-vs-nestable, action-only-on-button
// and the depth cap are all enforced once by validateComponentTree (DRY with the
// domain/use-case boundary check required by SPEC-CC-002 I-CC-002.5).
export const componentNodeSchema: z.ZodType<ComponentNode> = z.lazy(() =>
  z.object({
    kind: z.string(),
    order: z.number(),
    props: z.record(z.unknown()),
    action: z.string().optional(),
    children: z.array(componentNodeSchema).optional(),
  }),
) as z.ZodType<ComponentNode>;

export const componentChildrenSchema = z.array(componentNodeSchema).superRefine((children, ctx) => {
  try {
    validateComponentTree(children);
  } catch (error) {
    if (error instanceof InvalidComponentTreeError) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error.message });
      return;
    }
    throw error;
  }
});
