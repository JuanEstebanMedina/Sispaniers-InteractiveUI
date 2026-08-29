# Sispaniers InteractiveUI — Backend

Hexagonal (ports & adapters) scaffolding on Node.js + TypeScript + Fastify. The layers
are empty on purpose: only the wiring, the tooling and the pipeline are in place.

```
src/
  domain/
    model/          entities and value objects — plain TypeScript, no dependencies
    ports/          inbound (driving) and outbound (driven) contracts
  application/
    use-cases/      orchestration; depends only on domain ports
  infrastructure/
    adapters/
      inbound/http/ Fastify routes, schemas and the app factory
      outbound/     repositories and gateways
    config/         composition root — the only place that wires concretes
  main.ts           process entry point
scripts/smoke.ts    boots the built API and probes /health
```

The dependency rule: `domain` imports nothing from `application` or `infrastructure`,
and never a framework. `application` imports only `domain`.

## Commands

```bash
make install   # pnpm install
make check     # lint + types + tests
make test      # vitest
make dev       # API with autoreload on http://127.0.0.1:8000
make smoke     # build, boot the compiled app and probe /health
make ci        # the exact sequence CI runs
```

Health probe at `/health` — pre-existing scaffold plumbing used by `docker-compose`'s
healthcheck and `make smoke`, unrelated to the Ari endpoints below.

## Ari gateway API

Minimal slice: receive a normalized email (Make.com polls Gmail and posts here — not a
real webhook, there's no subscription/push involved) and send an outbound email. No
persistence yet — every request is only logged (`request.log.warn`), nothing is stored
or looked up. Run tracking and the real agent logic are later phases.

Attachments (`attachments[].{filename,mimetype,data}`, `data` base64) get their content
extracted by `mimetype` so a future AI hand-off gets usable content instead of raw
bytes — see `infrastructure/adapters/outbound/attachment/multi-format-attachment-extractor.ts`:

| mimetype | handling |
|---|---|
| `image/*` | passed through as-is (base64) — meant for a vision-capable model, no text extraction |
| `application/pdf` | text via `pdf-parse` |
| `.docx` | text via `mammoth` |
| `.pptx` | text via `officeparser` |
| `.xls` / `.xlsx` | each sheet converted to CSV via `xlsx` (SheetJS) |
| `text/csv` | passed through as-is (already the target format) |
| anything else | `kind: "unsupported"`, does not fail the request |

Nothing is sent to another AI yet — extraction results are only logged for now.

### Environment variables

Copy `.env.example` to `.env` and fill in (values are read via Node's native
`--env-file-if-exists`, wired into `dev`/`start` — no `dotenv` dependency needed):

| Variable | Purpose |
|---|---|
| `GMAIL_USER` | Gmail address used to send outbound email via `POST /api/emails/send`. |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not OAuth) for the address above, no spaces. |
| `PORT` | HTTP port (default `8000`). |

### curl examples

```bash
# Receive an email (Make.com posts here after its Gmail-watch poll finds one)
curl -X POST http://127.0.0.1:8000/api/emails/receive \
  -H "Content-Type: application/json" \
  -d '{
    "source": "make",
    "message_id": "msg-001",
    "from": "bookings@mscmed.com",
    "to": "ari@mueblesdelsur.com",
    "subject": "Booking Confirmation - MSC Vessel MSC LUCINDA",
    "received_at": "2026-08-29T14:30:00Z",
    "body_text": "Booking confirmed for container MEDU7788210."
  }'

# Send an email (no auth yet)
# TODO: proteger este endpoint con un secreto compartido con Make antes de producción
curl -X POST http://127.0.0.1:8000/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "<any-id>",
    "to": "cliente@example.com",
    "subject": "Actualizacion de tu embarque",
    "body_text": "Su embarque va en camino."
  }'
```

## Notes

The project is ESM with `moduleResolution: NodeNext`, so relative imports carry a `.js`
extension even in `.ts` files. That is correct, not a typo.
