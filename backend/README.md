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

### `POST /api/operations/search`

El **único** listado. Había también un `GET /api/operations` y se eliminó: dos
rutas para lo mismo son dos contratos que mantener y dos sitios donde arreglar
un bug de filtrado. Los filtros de la web —texto libre, estado, salud, empresa,
rango de fechas y orden— no caben en una query string legible, así que la que
sobrevive es la que puede con todo. Un body vacío lista todo.

Todos los campos son opcionales; un body vacío lista todo.

| Campo | Tipo | Comportamiento |
|---|---|---|
| `search` | string | subcadena sin distinguir mayúsculas sobre el id de la operación, los ids de empresa y los puertos |
| `status` | container state | filtra sobre el status **derivado**, en memoria |
| `health` | `ok` \| `warning` \| `error` | filtra en Mongo |
| `company_id` | string | operaciones de esa empresa |
| `from` / `to` | fecha ISO | rango sobre `created_at` |
| `date` | fecha ISO | ese día UTC; **no se combina** con `from`/`to` |
| `sort_by` | `updatedAt` \| `company` \| `id` | `updatedAt` es derivado: el cambio de ETA más reciente, o la creación |
| `sort_dir` | `asc` \| `desc` | por defecto `desc` |

```bash
curl -X POST http://127.0.0.1:8000/api/operations/search \
  -H "Content-Type: application/json" \
  -d '{ "search": "andes", "sort_by": "id", "sort_dir": "asc" }'
```

`200` → `{ "operations": [ ... ] }` · `400` → `invalid_filter_combination` · `404` → `company_not_found`

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
| `404` | `operation_not_found` | no operation with that id |
| `404` | `company_not_found` | no company with that id |
| `502` | `email_send_failed` | SMTP rejected the message |

## Things the code will not tell you at a glance

**`company_ids` on an operation is derived, never stored.** It is the union of
`bookings[].companyIds`, computed when the response is built. Ownership itself lives in
one place only: `Company.operationIds`. An operation with no bookings answers with an
empty list, which is the truth.

**Documents are pointers, not payloads.** A `Document` carries a `bucketKey` into S3
plus a `format` (`pdf`, `spreadsheet`, `document`, `image`, `other`) and whatever the
extractor could scrape into `extractedData`. The bytes never reach Mongo, and neither do
email attachments: `NormalizedEmail` is a transport DTO, and only the lightweight
`ContextEmail` projection is persisted.

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
