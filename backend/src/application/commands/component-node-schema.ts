import type { JsonSchema } from "../../domain/commands/json-schema.js";

export const componentNodeSchema: JsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string" },
    order: { type: "number" },
    props: { type: "object" },
  },
  required: ["kind", "order", "props"],
};

export const layoutSchema: JsonSchema = {
  type: "object",
  properties: { cols: { type: "number" }, rows: { type: "number" } },
  required: ["cols", "rows"],
};
