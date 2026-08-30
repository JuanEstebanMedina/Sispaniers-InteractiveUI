import type { JsonSchema } from "../../domain/commands/json-schema.js";
import { ACTION_KINDS, ATOMIC_NODE_KINDS } from "../../domain/enums/widget-kind.js";

export const componentNodeSchema: JsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...ATOMIC_NODE_KINDS] },
    order: { type: "number" },
    props: { type: "object" },
    action: { type: "string", enum: [...ACTION_KINDS] },
  },
  required: ["kind", "order", "props"],
};

export const layoutSchema: JsonSchema = {
  type: "object",
  properties: { cols: { type: "number" }, rows: { type: "number" } },
  required: ["cols", "rows"],
};

export const replySchema: JsonSchema = { type: "string" };
