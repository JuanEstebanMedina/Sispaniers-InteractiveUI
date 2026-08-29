# Sispaniers InteractiveUI — Backend

Fastify + TypeScript API behind a hexagonal (ports & adapters) layout. It owns the
logistics domain (operations, bookings, containers, documents), persists it in MongoDB
and exposes it to the runtime-generated UI.

Node.js >= 22 and pnpm 8.15 (`corepack enable`). Setup, git hooks and the validation
pipeline live in the [root README](../README.md); `make help` lists every command.

`domain` imports nothing from `application` or `infrastructure`, and never a framework.
`application` imports only `domain`. `infrastructure/config/composition.ts` is the only
place that wires concretes.

`Operation` is the single aggregate root: bookings, containers and documents live
embedded in one Mongo document, so a whole shipment is read and written atomically.

## Environment

There is one `.env` for the whole repo, at the **root** — not inside `backend/`.
Copy `.env.example` to `.env` and fill it in.

| Variable | Default | Purpose |
|---|---|---|
| `MONGO_PASSWORD` | — | **required**, compose refuses to start without it |
| `MONGO_USER` | `sispaniers` | Mongo root user |
| `MONGO_DB` | `sispaniers` | database name |
| `MONGO_PORT` | `27017` | host port Mongo is published on |
| `BACKEND_PORT` | `8000` | host port the API container is published on |
| `MONGODB_URI` | derived | full connection string; overrides the four vars above |
| `PORT` | `8000` | port the Node process listens on (inside the container it stays `8000`) |
| `GMAIL_USER` | — | Gmail address used by `POST /api/emails/send` |
| `GMAIL_APP_PASSWORD` | — | Gmail **App Password** (not OAuth, no spaces, needs 2FA) |
| `OPENAI_MODEL` | `gpt-4o-mini` | model id for the OpenAI adapter |
| `GEMINI_MODEL` | `gemini-2.0-flash` | model id for the Gemini adapter |

Mongo connection resolution order (`src/infrastructure/config/mongo.ts`):
`MONGODB_URI` → a URI built from `MONGO_USER`/`MONGO_PASSWORD`/`MONGO_PORT`/`MONGO_DB`
against `localhost` → `mongodb://localhost:27017/sispaniers`.

## Seed

The collection starts empty. `make seed` loads four synthetic operations covering every
container state, a booking whose ETA slipped, a two-booking operation and one with no
bookings at all. It runs on the host against `localhost`, so Mongo must already be up.

The seed **upserts by id** and is safe to re-run; it does not wipe the collection. To
start from scratch: `docker compose down -v && docker compose up -d mongo`.

## API

Base URL `http://127.0.0.1:8000`. Everything under `/api` except `/health`.
CORS is open (`origin: true`). **No authentication yet** — do not expose this publicly.

Request and response bodies use `snake_case`; the domain internally uses `camelCase`.
Dates are ISO-8601 strings.

### `GET /health`

Liveness probe used by the compose healthcheck and `make smoke`. Returns `{"status":"ok"}`.

### `POST /api/flows`

Creates an operation. Bookings and documents start empty, so the derived status is
always `booking_confirmed`.

```bash
curl -X POST http://127.0.0.1:8000/api/flows \
  -H "Content-Type: application/json" \
  -d '{ "client_id": "client-andes-textiles", "health": "ok" }'
```

| Field | Type | Required |
|---|---|---|
| `client_id` | string, non-empty | yes |
| `health` | `ok` \| `warning` \| `error` | no, defaults to `ok` |

`201` returns the flow object.

### `GET /api/flows`

Lists operations. All query parameters are optional.

| Parameter | Type | Behaviour |
|---|---|---|
| `status` | container state | filters on the **derived** status, in memory |
| `health` | `ok` \| `warning` \| `error` | filters in Mongo |
| `search` | string | case-insensitive substring match on `client_id` |
| `from` / `to` | ISO date | `created_at` range |
| `date` | ISO date | that whole UTC day; **cannot be combined** with `from`/`to` |

```bash
curl "http://127.0.0.1:8000/api/flows?status=in_transit&search=andes"
```

`200` → `{ "flows": [ ... ] }`

### `GET /api/flows/:id`

```bash
curl http://127.0.0.1:8000/api/flows/op-andes-textiles-001
```

`200` → a flow object. `404` → `flow_not_found`.

A flow object is `id`, `client_id`, `status`, `health`, `created_at`, `bookings[]` and
`documents[]`. Run the curl above against a seeded database for the full shape.

### `POST /api/emails/receive`

Entry point for an inbound email. Make.com polls Gmail and posts here — this is not a
real webhook, there is no subscription or push involved. Nothing is persisted: the
request is logged and a `run_id` is generated.

```bash
curl -X POST http://127.0.0.1:8000/api/emails/receive \
  -H "Content-Type: application/json" \
  -d '{
    "source": "make",
    "message_id": "msg-001",
    "from": "bookings@mscmed.com",
    "to": "ari@mueblesdelsur.com",
    "subject": "Booking Confirmation - MSC LUCINDA",
    "received_at": "2026-08-29T14:30:00Z",
    "body_text": "Booking confirmed for container MEDU7788210."
  }'
```

Required: `source` (`make` \| `gmail` \| `outlook` \| `manual`), `message_id`, `from`,
`subject`, `received_at` (ISO-8601 **with offset**). Optional: `to`, `body_text`,
`body_html`, `attachments[]`.

`201` → `{ "run_id": "...", "status": "queued" }`.

Each attachment is `{ filename, mimetype, data }` with `data` base64-encoded. Content is
extracted by `mimetype` so a future AI hand-off gets usable text instead of raw bytes:

| mimetype | handling |
|---|---|
| `image/*` | passed through as base64 — meant for a vision model, no text extraction |
| `application/pdf` | text via `pdf-parse` |
| `.docx` | text via `mammoth` |
| `.pptx` | text via `officeparser` |
| `.xls` / `.xlsx` | each sheet converted to CSV via `xlsx` (SheetJS) |
| `text/csv` | passed through as-is |
| anything else | `kind: "unsupported"` — does not fail the request |

Extraction results are only logged for now; nothing is handed to an AI yet.

### `POST /api/emails/send`

Sends an outbound email through Gmail SMTP. Nothing is persisted — the request is only
logged. Requires `GMAIL_USER` and `GMAIL_APP_PASSWORD`.

```bash
curl -X POST http://127.0.0.1:8000/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "run-001",
    "to": "cliente@example.com",
    "subject": "Actualizacion de tu embarque",
    "body_text": "Su embarque va en camino."
  }'
```

Required: `run_id`, `to`, `subject`, `body_text`. Optional: `body_html`, `in_reply_to`.
`201` → `{ "email_id": "...", "status": "sent" }`.

### Errors

Every error response is `{ "error": "<machine_code>", "message": "<human text>" }`.

| Status | `error` | Cause |
|---|---|---|
| `400` | `validation_error` | body, params or querystring failed the zod schema; adds a `details` array |
| `400` | `invalid_filter_combination` | `date` sent together with `from`/`to` |
| `404` | `flow_not_found` | no operation with that id |
| `502` | `email_send_failed` | SMTP rejected the message |

## Things the code will not tell you at a glance

**`status` is derived, never stored.** Container states run
`booking_confirmed` → `in_transit` → `arrived_port` → `customs` → `delivered`. A booking's
status is its *least advanced* container; an operation's status is its least advanced
booking, ignoring bookings with no containers. One container stuck in customs keeps the
whole operation in customs — the pessimistic reading is the useful one for a supervisor.
`health` is the opposite: stored, and set explicitly.

**Relative imports carry a `.js` extension even in `.ts` files.** The project is ESM with
`moduleResolution: NodeNext`. That is correct, not a typo.

**The OpenAI and Gemini adapters are not wired in.** They exist and read
`OPENAI_MODEL` / `GEMINI_MODEL`, but nothing instantiates them in the composition root.

**HTTP endpoints have no integration tests.** Tests are unit tests over the domain and
the use cases, with an in-memory repository as the double; endpoints are verified
manually with Postman.
