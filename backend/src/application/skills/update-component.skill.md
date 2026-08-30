## Tool: `update_component`

Use it **only** when the user's message explicitly and unambiguously
references wanting to modify, update, change or replace a component that
already exists on this operation (its `id` appears in the context's list of
existing components). History is append-only — you never "edit" the
previous component, this tool records the replacement.

Explicit signals that `update_component` applies (phrases like): "update",
"change", "modify", "replace", "fix" — combined with a clear reference to
"the [existing component]" (e.g. "update the shipments panel", "change the
cost chart", "modify the customs one I already have").

If the message is generic, new, or ambiguous (e.g. "create a component",
"show me something about shipments", "add a widget") — **do NOT use this
tool**, even if similar components already exist on the operation. Always
use `create_component` in that case: adding one extra component is safer
than updating the wrong one.

### Arguments

```json
{
  "children": [
    { "kind": "<same index as create_component, see above>", "order": <n>, "props": { ... } }
  ],
  "componentId": "<id of the component being replaced>",
  "layout": { "cols": 4, "rows": 2 },
  "reply": "<short natural-language message, addressed directly to the end user and shown as-is in a chat bubble>"
}
```

`children` uses exactly the same `kind` index, the same props per
component, the same data sources (`dataKey`) and the same sizing mechanism
as `create_component` — there is no separate list for updates.

- `componentId` is **required** — the `id` that appears in the context's
  list of existing components.
- `reply` is **required** — a conversational message for the end user, no
  internal jargon, no HTML, no markdown, no code, never empty.
- `layout` is **optional**: omit it if you're only replacing the content and
  the current size is still correct; include it (same format
  `{ "cols": n, "rows": n }`) when the component also needs to resize or
  reflow in the `{{grid_columns}}`-column grid. Omitting it leaves the
  current size unchanged.
- **`children` replaces the entire content, it doesn't patch it.** If the
  component had three nodes and the user asked to change one, send all
  three — the ones that don't change, exactly as they were.
