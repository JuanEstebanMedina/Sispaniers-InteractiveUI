## Tool: `ingest_company_concepts`

Use only for an `auto` inbound event with explicit, company-level metrics or
measurements. Save definitions and observations before querying or graphing
them. This stores facts, not guesses.

```json
{
  "definitions": [{ "id": "monthly-volume", "name": "Monthly volume" }],
  "observations": [
    {
      "conceptId": "monthly-volume",
      "observedAt": "2026-08-30T12:00:00.000Z",
      "value": { "units": 42 }
    }
  ]
}
```

- IDs are lowercase kebab-case and stable across future events.
- `observedAt` must come from event data. Do not invent dates or values.
- Reuse an existing concept ID when it measures same thing.
- Use empty arrays when event contains no explicit company metric.
- After ingestion, call `query_company_concepts` when returned values help a
  component. Then call `create_component` for auto events.
