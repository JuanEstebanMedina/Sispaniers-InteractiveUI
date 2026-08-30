## Tool: `update_component`

Use it **only** when the user's message explicitly and unambiguously refers
to modifying, updating, changing, or replacing a component already in this
operation (its `id` appears in the existing-components context). History is
append-only: never edit prior component; this tool records its replacement.

Explicit signals for `update_component` include "update", "change",
"modify", or "replace" combined with a clear reference to an existing
component, such as "update the shipments panel", "change the costs chart",
or "modify my customs component".

If the message is generic, new, or ambiguous, such as "create a component",
"show shipment data", or "add a widget", **do not use this tool**, even if
similar components exist. Use `create_component`: an extra component is safer
than updating the wrong one.

### Arguments

```json
{
  "children": [
    { "kind": "<uno de component_catalog>", "order": <n>, "props": { ... } }
  ],
  "componentId": "<id del componente que reemplaza>",
  "layout": { "cols": 4, "rows": 2 },
  "reply": "<mensaje breve en lenguaje natural, dirigido directamente al usuario final y mostrado tal cual en una burbuja de chat>"
}
```

- IMPORTANT: `kind` must be EXACTLY one of these values; never invent others:
  `title`, `trend-chart`, `category-chart`, `breakdown-chart`, `stat`,
  `label`, `button`, `layout`. Any other value is rejected.
- `componentId` is **required**. Use `id` from existing-components context.
- `reply` is **required**. It is a conversational message for the end user:
  no internal jargon, HTML, markdown, or code; never empty.
- `layout` is **optional**. Omit it when replacing content only and current
  size remains correct. Include `{ "cols": n, "rows": n }` when component
  also needs resizing or grid rearrangement in `{{grid_columns}}` columns.
  Omitting it preserves current size.
- When including `layout`, respect chosen `kind` range
  (`minCols/maxCols`, `minRows/maxRows`), same as `create_component`.
