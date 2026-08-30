# Sispaniers InteractiveUI — Backend

Fastify + TypeScript API behind a hexagonal (ports & adapters) layout. It owns the
logistics domain (companies, operations, bookings, containers and the context of emails
and documents an agent reads), persists it in MongoDB and exposes it to the
runtime-generated UI.

Node.js >= 22 and pnpm 8.15 (`corepack enable`). Setup, git hooks and the validation
pipeline live in the [root README](../README.md); `make help` lists every command.

`domain` imports nothing from `application` or `infrastructure`, and never a framework.
`application` imports only `domain`. `infrastructure/config/composition.ts` is the only
place that wires concretes.

`Operation` is the aggregate root of a shipment: bookings, containers and the agent's
`context` live embedded in one Mongo document, so a whole shipment is read and written
atomically. `Company` is a second, small root in its own collection; it owns the ids of
the operations it is responsible for.

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
| `SUPABASE_URL` | — | project URL, used to upload email attachments to Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | — | service role (secret) key — bypasses RLS for server-side uploads |

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

> These endpoints are `/api/operations`, not `/api/flows`. A *flow* is the sequence of
> steps an agent executes (see the glossary in the root README); an *operation* is the
> shipment the agent works on. They are different things.

### `POST /api/operations`

Creates an operation and appends its id to the owning company. Bookings and context
start empty, so the derived status is always `booking_confirmed`.

```bash
curl -X POST http://127.0.0.1:8000/api/operations \
  -H "Content-Type: application/json" \
  -d '{ "company_id": "company-andes-textiles", "health": "ok" }'
```

| Field | Type | Required |
|---|---|---|
| `company_id` | string, non-empty | yes; `404` if the company does not exist |
| `health` | `ok` \| `warning` \| `error` | no, defaults to `ok` |

`201` returns the operation object.

### `GET /api/operations`

Lists operations. All query parameters are optional.

| Parameter | Type | Behaviour |
|---|---|---|
| `status` | container state | filters on the **derived** status, in memory |
| `health` | `ok` \| `warning` \| `error` | filters in Mongo |
| `company_id` | string | matches the owning company or any booking party, in Mongo |
| `from` / `to` | ISO date | `created_at` range |
| `date` | ISO date | that whole UTC day; **cannot be combined** with `from`/`to` |

```bash
curl "http://127.0.0.1:8000/api/operations?status=in_transit&company_id=company-andes-textiles"
```

`200` → `{ "operations": [ ... ] }`

### `GET /api/operations/:id`

```bash
curl http://127.0.0.1:8000/api/operations/op-andes-textiles-001
```

`200` → an operation object. `404` → `operation_not_found`.

An operation object is `id`, `company_ids`, `status`, `health`, `created_at`,
`bookings[]` and `context`. Run the curl above against a seeded database for the full
shape.

### `POST /api/emails/receive`

Entry point for an inbound email. Make.com polls Gmail and posts here — this is not a
real webhook, there is no subscription or push involved. A `run_id` is generated and the
request is logged; if the subject links to an operation (see below), that operation is
also created or updated in Mongo.

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

`201` → `{ "run_id": "...", "status": "queued", "operation_id"?: "..." }` — `operation_id`
is present only when the subject matched (see below).

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
| anything else | `format: "other"` — does not fail the request |

The original attachment bytes are also uploaded to Supabase Storage (private bucket
`email-attachments`, keyed by `message_id/filename`) — see
`infrastructure/adapters/outbound/storage/supabase-attachment-storage.ts`. A successful
upload adds `storagePath` to that attachment's entry; a failed one adds `storageError`
instead, without failing the whole request. Nothing generates a signed download/preview
URL yet, and nothing is handed to an AI — but the operation link below does persist.

**Subject links the email to an operation.** If the subject matches
`Orden de compra #<id>` (case-insensitive), `<id>` is used as the operation id: an
existing operation is fetched and updated, a missing one is created from scratch. The
email is appended to `context.emails`, and one `Document` per **successfully uploaded**
attachment (`storagePath` present) is appended to `context.documents` — `bucketKey` is
that `storagePath`, `extractedData` is `{ text: <extracted content> }` (`{}` for images,
nothing meaningful extracted as text), and `type` is hardcoded to `"PO"` for now (see the
TODO in `upsert-operation-from-email.use-case.ts` — no real document classification
yet). Re-processing the same `message_id` against an operation that already has it is a
no-op (Make's polling can double-post the same email). A subject that doesn't match the
pattern skips this step entirely — extraction and upload above still happen either way.

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
| `404` | `operation_not_found` | no operation with that id |
| `404` | `company_not_found` | no company with that id |
| `502` | `email_send_failed` | SMTP rejected the message |

## Things the code will not tell you at a glance

**Two different company links, on purpose.** `Operation.companyId` is the company the
operation was opened *for* — absent when the operation came from an inbound email, where
no company is known yet. `bookings[].companyIds` are the parties on each booking, which
may differ per booking. The `company_ids` field in the response is the union of both,
computed when the response is built and never stored, and `?company_id=` matches either.
A company holds no list of its operations: that duplicate could only drift.

**Documents are pointers, not payloads.** A `Document` carries a `bucketKey` into an
S3-compatible bucket (Supabase Storage, not AWS) plus a `format` (`pdf`, `spreadsheet`,
`document`, `image`, `other`) and whatever the extractor could scrape into
`extractedData`. The bytes never reach Mongo, and neither do email attachments:
`NormalizedEmail` is a transport DTO, and only the lightweight `ContextEmail` projection
is persisted.

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
