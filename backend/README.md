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
| `SIMULATION_TICK_INTERVAL_MS` | `20000` | how often the shipment simulator advances (see below) |

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

### The shipment simulator

There is no real carrier tracking feed wired in, so a simulator stands in for one. Every
operation created from now on (via `POST /api/operations` or a booking-linking email —
existing/seeded operations are untouched) gets, at creation time:

- a synthetic `Booking` (carrier, vessel, ports, an initial schedule, one container),
  saved immediately — this is why a freshly created operation already has a booking a
  moment after the `201` response, not inside it
- a random script from `SIMULATION_SCRIPTS` (`domain/logistics/simulation-script.ts`) —
  five canned narratives (`smooth`, `transshipment_delay`, `customs_hold`,
  `ahead_of_schedule`, `compound_problem`) so operations running side by side don't all
  tell the same story

A single server-wide timer (`SIMULATION_TICK_INTERVAL_MS`, default 20s) advances every
registered operation by one step of its script each tick — mutating `vesselPosition`,
appending a `ScheduleChange`, or moving a container to its next `ContainerState` — and
publishes the change (see SSE, below). A script that runs out (some end mid-journey on
purpose, e.g. `customs_hold`) stops advancing that operation and publishes
`simulation-completed`, which closes that operation's SSE stream (see below) — nothing
errors, and the operation itself is untouched, just no more events will ever arrive
for it.

Multiple operations run independently and concurrently — there's no cross-operation
locking, so a slow step for one never delays another. If a step fails for one operation
(Mongo hiccup, etc.), only that tick's remaining operations are skipped for that round;
none of them lose progress, they're all retried on the next tick since nothing gets
marked as advanced until it actually succeeds. The registry is in-memory, per process:
restarting the server resets every operation's simulation back to its first step.

Disconnecting from the SSE stream (below) does **not** pause the simulation — the timer
keeps running server-side regardless of who's watching. Reconnect later and you'll see
the operation's current state, just not the events you missed in between (SSE pushes
live, nothing is buffered for reconnects).

```bash
# force one specific event instead of waiting for the timer — useful live
curl -X POST http://127.0.0.1:8000/api/operations/op-andes-textiles-001/tracking-events \
  -H "Content-Type: application/json" \
  -d '{ "type": "schedule_change", "booking_id": "b-1", "new_eta": "2026-09-30T00:00:00Z", "reason": "manual test" }'
```

`type` is `vessel_position` (`booking_id`, `lat`, `lng`) | `schedule_change`
(`booking_id`, `new_eta`, `reason`) | `container_state` (`booking_id`, `container_id`,
`state`). `200` → the updated operation object. `404` → `operation_not_found`,
`booking_not_found` or `container_not_found`.

### `GET /api/operations/:id/events` — Server-Sent Events

One stream per operation, meant for an `EventSource` in the browser — no extra library
needed on either side. Multiple viewers of the **same** operation all get the **same**
events at the same time: the publisher is one shared in-process event emitter keyed by
operation id, so every open connection is just another subscriber on it.

```bash
curl -N http://127.0.0.1:8000/api/operations/op-andes-textiles-001/events
```

Three event types share the stream, distinguished by SSE's `event:` field:

| `event:` | `data:` payload | Fired by |
|---|---|---|
| `operation-updated` | the full operation object (same shape as `GET /api/operations/:id`) | the simulator's timer, `POST .../tracking-events`, or enrolling a new operation |
| `simulation-completed` | the full operation object, same shape | the simulator's timer, once that operation's script has no steps left |
| `component-created` / `component-updated` | a generated-UI component | the dashboard component endpoints (`operation-components.routes.ts` — not documented here yet) |

`simulation-completed` is terminal: the server writes that one event and then closes
the connection (`reply.raw.end()`) — there's nothing left to stream once a script runs
out, so the stream ends instead of sitting open silently forever. A client that wants
to know when an operation's story is "done" watches for this event rather than for the
connection just going quiet.

### `POST /api/operations/:id/documents`

Uploads a document straight onto an operation — the manual counterpart to what
`POST /api/emails/receive` does automatically per attachment. Same three steps: upload
the original bytes to Supabase Storage, extract text via the same `mimetype` table as
the email flow, append a `Document` to `context.documents` in Mongo. Unlike the email
flow, a failed Storage upload here **fails the request** (`502`) instead of degrading
gracefully — a direct upload has no point if the file never lands anywhere.

```bash
curl -X POST http://127.0.0.1:8000/api/operations/op-andes-textiles-001/documents \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "invoice.pdf",
    "mimetype": "application/pdf",
    "data": "<base64>",
    "type": "Invoice"
  }'
```

Required: `filename`, `mimetype`, `data` (base64). Optional: `type` (`PO` \|
`BookingConfirmation` \| `BillOfLading` \| `Invoice` \| `PackingList` \| `ArrivalNotice`,
defaults to `PO`) — unlike the email flow, a human uploading a file usually knows what
it is, so it's not hardcoded here.

`201` → `{ "document": { ...same shape as a context.documents[] entry, snake_case... },
"url": "...", "expires_in_seconds": 300 }`. `404` → `operation_not_found`. `502` →
`document_upload_failed`.

**TODO**: no auth yet — see the comment in `operations.routes.ts`.

### `GET /api/operations/:id/documents/:documentId/preview-url`

A signed, time-limited URL for downloading or previewing one document's bytes straight
from Supabase Storage — works for documents from either upload path above.

```bash
curl http://127.0.0.1:8000/api/operations/op-andes-textiles-001/documents/doc-1/preview-url
```

`200` → `{ "url": "...", "expires_in_seconds": 300 }`. `404` → `operation_not_found` or
`document_not_found`. Opening the URL in a browser previews it inline when the type is
renderable (image, PDF); otherwise the browser downloads it or shows it as plain text —
there's no separate "preview" vs "download" URL, it's the same signed URL either way.

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
instead, without failing the whole request. Nothing is handed to an AI yet — but the
operation link below does persist, and `GET /api/operations/:id/documents/:documentId/preview-url`
(below) gets a signed URL for any uploaded document, from this flow or the manual one.

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
| `404` | `document_not_found` | no document with that id on that operation |
| `404` | `booking_not_found` | no booking with that id on that operation |
| `404` | `container_not_found` | no container with that id on that booking |
| `502` | `email_send_failed` | SMTP rejected the message |
| `502` | `document_upload_failed` | Supabase Storage rejected the upload |

## Things the code will not tell you at a glance

**`company_ids` on an operation is derived, never stored.** It is the union of
`bookings[].companyIds`, computed when the response is built. Ownership itself lives in
one place only: `Company.operationIds`. An operation with no bookings answers with an
empty list, which is the truth.

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
