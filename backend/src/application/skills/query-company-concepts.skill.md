## Tool: `query_company_concepts`

Use this tool before creating a component when company-level data is needed and
the operation data already in context is insufficient. It only reads concepts
that belong to current operation's company.

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
