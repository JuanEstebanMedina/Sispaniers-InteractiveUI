## Tool: `query_company_concepts`

Use this tool whenever company-level data is needed and the operation data
already in context is insufficient. It only reads concepts that belong to
current operation's company.

Two situations need it:

1. **Before creating a component**, when the values it must show are not in
   context.
2. **To answer a question about a component that already exists.** A node with
   `props.dataKey` of the form `concept:<id>` carries only that pointer in the
   prompt — never its values. Asked what such a widget shows or what its
   figures mean, call this tool with that `<id>` and answer from the result.
   Answering "I don't have the values" without calling it first is wrong: the
   values are one call away.

### Arguments

```json
{ "conceptIds": ["on-time-delivery", "monthly-volume"] }
```

- Call with an empty `conceptIds` array first when available concept IDs are not
  in context. Then request only concepts needed for current answer or component,
  up to 20. Never guess an ID.
- Tool returns recent observations grouped by concept. Missing concepts return
  no entry; say data is unavailable rather than inventing values.
- After result, use returned values to answer user or call `create_component`.
- For a component that must refresh values at render time, set its node
  `props.dataKey` to `concept:<concept-id>`. Do not copy observations into
  `props.data` in that case.
- Never expose internal IDs or raw tool output in final user reply.
