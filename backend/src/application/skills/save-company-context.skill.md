## Tool: `save_company_context`

Analyze current message and available history. Use it when the user shares a
stable company fact, policy, preference, or process that can improve future
operations, even without words such as "save" or "remember". Store one
concrete, short, self-contained fact in `context`; remove conversational
noise and rephrase without changing meaning.

Useful examples: usual ports, shipment frequency, notification rules,
preferred carriers, document requirements, and operational owners. This
knowledge becomes available to every company operation.

Do not use it for temporary operation data, casual messages, your inferences,
or ambiguous facts. Never save secrets, credentials, bank data, sensitive
identifiers, or unnecessary personal information. If no useful durable
knowledge exists, reply without calling tool.

### Arguments

```json
{
  "context": "La empresa prefiere consolidar embarques semanales desde Cartagena.",
  "reply": "Lo guardaré como preferencia general de la empresa."
}
```
