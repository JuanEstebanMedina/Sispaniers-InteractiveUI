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

Env vars live in `backend/.env` (this directory), not at the repo root. Copy
`backend/.env.example` to `backend/.env` and fill it in. `docker compose` at the repo
root needs `--env-file backend/.env --env-file frontend/.env` to pick up both — see the
root README.

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | — | **required**, `JwtTokenAdapter` throws at boot if it is empty |
| `MONGO_PASSWORD` | — | **required**, compose refuses to start without it |
| `MONGO_USER` | `sispaniers` | Mongo root user |
| `MONGO_DB` | `sispaniers` | database name |
| `MONGO_PORT` | `27017` | host port Mongo is published on |
| `BACKEND_PORT` | `8000` | host port the API container is published on |
| `MONGODB_URI` | derived | full connection string; overrides the four vars above |
| `PORT` | `8000` | port the Node process listens on (inside the container it stays `8000`) |
| `CORS_ORIGIN` | unset | `*` for open demo access; unset means same-origin only |
| `GMAIL_USER` | — | Gmail address used by `POST /api/emails/send` |
| `GMAIL_APP_PASSWORD` | — | Gmail **App Password** (not OAuth, no spaces, needs 2FA) |
| `OPENAI_API_KEY` | — | primary AI provider; without it every AI call fails with an auth error |
| `OPENAI_MODEL` | `gpt-5.6-luna` | model id for the OpenAI adapter |
| `GEMINI_API_KEY` | — | fallback AI provider, used when OpenAI fails |
| `GEMINI_MODEL` | `gemini-2.0-flash` | model id for the Gemini adapter |
| `SUPABASE_URL` | — | project URL, used to upload email attachments to Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | — | service role (secret) key — bypasses RLS for server-side uploads |
| `SIMULATION_TICK_INTERVAL_MS` | `20000` | how often the shipment simulator advances (see below) |

Mongo connection resolution order (`src/infrastructure/config/mongo.ts`):
`MONGODB_URI` → a URI built from `MONGO_USER`/`MONGO_PASSWORD`/`MONGO_PORT`/`MONGO_DB`
against `localhost` → `mongodb://localhost:27017/sispaniers`.

## Seed

The collections start empty. `make seed` loads three companies, their users, and four
synthetic operations covering every container state, a booking whose ETA slipped, a
two-booking operation and one with no bookings at all. It runs on the host against
`localhost`, so Mongo must already be up.

The seeded users are what you log in with — every password is in
`scripts/seed-data.json`, in plain text, because this is a hackathon fixture and nothing
else. The one that sees everything:

```
admin@sispaniers.com / sispaniers-dev     (superadmin)
```

Each company also gets an `admin@…` and a `user@…` scoped to it.

The seed **upserts by id** and is safe to re-run; it does not wipe the collection. To
start from scratch, from the repo root (both `--env-file` flags are required):

```bash
docker compose --env-file backend/.env --env-file frontend/.env down -v
docker compose --env-file backend/.env --env-file frontend/.env up -d mongo
```

## API

Base URL `http://127.0.0.1:8000`. Everything under `/api` except `/health`.
CORS is whatever `CORS_ORIGIN` says (`*` for the demo, same-origin when unset).

Request and response bodies use `snake_case`; the domain internally uses `camelCase`.
Dates are ISO-8601 strings. The auth endpoints are the exception — they speak
`camelCase` (`accessToken`, `refreshToken`, `expiresIn`), since they were written
against the frontend's session store rather than the logistics wire format.

### Authentication

Everything is behind a bearer token except `/health`, `/api/auth/*` and `/api/emails/*`
— the email endpoints stay open because Make.com posts into them with no session of its
own (**TODO**: they need a shared secret before this faces anything real).

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@sispaniers.com", "password": "sispaniers-dev" }' | jq -r .accessToken)

curl http://127.0.0.1:8000/api/operations/search -X POST \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
```

A missing or expired token is `401` → `unauthorized`, from a `preHandler` hook that
runs on a nested Fastify plugin. The nesting is the point: Fastify scopes hooks to the
instance a plugin is registered on, so registering the login routes *before* that child
context is what keeps the hook from leaking backwards onto them.

### `GET /health`

Liveness probe used by the compose healthcheck and `make smoke`. Returns `{"status":"ok"}`.

### `POST /api/auth/login` · `POST /api/auth/refresh` · `POST /api/auth/logout` · `GET /api/auth/me`

`login` takes `{ email, password }` and returns `{ accessToken, refreshToken, expiresIn,
user }`. The access token lives **30 minutes**, the refresh token **7 days**; `refresh`
takes `{ refresh_token }` and returns a fresh pair. `logout` is a client-side courtesy —
nothing is revoked server-side, there is no token blacklist, so a stolen access token
stays valid until it expires. `me` returns the caller's own user from the token's `sub`.

`401` → `invalid_credentials` (wrong email/password, or a refresh token that no longer
verifies). `404` → `user_not_found`.

### `GET /api/users` · `POST /api/users` · `PATCH /api/users/:id`

Roles are `user` < `admin` < `superadmin`, ordered. The rule is company scope, and it
lives in the use cases, not in the routes:

- a **superadmin** sees and edits every user, may pass `?company_id=` to filter the list,
  may set `company_id` on creation, and is the only role that can mint or promote another
  superadmin
- anyone else is pinned to their own `companyId` — the list is filtered to it, a created
  user inherits it regardless of what the body asked for, and touching a user from another
  company is `403` → `forbidden`

`POST` takes `{ email, password, name, role, company_id? }` and returns `201`. `PATCH`
takes any of `{ name, role, active, password }`. There is no `DELETE`: a user is
disabled with `{ "active": false }`, same as a company. `409` → `email_conflict`.

> These endpoints are `/api/operations`, not `/api/flows`. A *flow* is the sequence of
> steps an agent executes (see the glossary in the root README); an *operation* is the
> shipment the agent works on. They are different things.

### `GET /api/companies`

Lists every company, unfiltered and unpaginated — fine at hackathon scale.

```bash
curl http://127.0.0.1:8000/api/companies
```

`200` → `{ "companies": [ ... ] }`, each the same shape `POST /api/companies` returns.

### `POST /api/companies`

Idempotent by `name` (case-insensitive exact match): posting a name that already exists
returns the existing company (`200`) instead of creating a duplicate; a new name creates
one (`201`). Doubles as "find or create" for callers that just have a name.

```bash
curl -X POST http://127.0.0.1:8000/api/companies \
  -H "Content-Type: application/json" \
  -d '{ "name": "Andes Textiles", "contact_emails": ["ops@andestextiles.co"] }'
```

| Field | Type | Required |
|---|---|---|
| `name` | string, non-empty | yes — the idempotency key |
| `contact_emails` | string[] | no, defaults to `[]` |
| `preferred_notification_channel` | `email` \| `slack` | no, defaults to `email` |

`200` (existing) or `201` (new) → the company object (`id`, `name`, `contact_emails`,
`preferred_notification_channel`, `active`). New companies are always created `active: true`.

### `PATCH /api/companies/:id`

Partial update — every field is optional, only what's sent changes. There is no
`DELETE`: a company is never removed, only **disabled** with `{ "active": false }` on this
same endpoint — its data, and every operation that already references it, stays intact.
Re-enabling is the same request with `{ "active": true }`.

```bash
# a regular field update
curl -X PATCH http://127.0.0.1:8000/api/companies/company-andes-textiles \
  -H "Content-Type: application/json" \
  -d '{ "preferred_notification_channel": "slack" }'

# disable instead of delete
curl -X PATCH http://127.0.0.1:8000/api/companies/company-andes-textiles \
  -H "Content-Type: application/json" \
  -d '{ "active": false }'
```

Same fields as `POST /api/companies`, plus `active` (boolean), all optional. `200` → the
updated company object. `404` → `company_not_found`. `409` → `company_name_conflict` if
`name` is changed to one already used by a **different** company (the same idempotency
key `POST` relies on, so renaming can't quietly create a duplicate elsewhere).

A disabled company still shows up in `GET /api/companies` and `POST /api/operations`'s
`company_id` lookups keep working against it — disabling doesn't hide or lock it, it's
just a flag for the UI to grey out or filter on.

### `POST /api/operations`

Creates an operation and links it to a company. Bookings and context start empty, so the
derived status is always `booking_confirmed`.

```bash
# by an existing company's id
curl -X POST http://127.0.0.1:8000/api/operations \
  -H "Content-Type: application/json" \
  -d '{ "company_id": "company-andes-textiles", "health": "ok" }'

# or find-or-create by name, same idempotency as POST /api/companies
curl -X POST http://127.0.0.1:8000/api/operations \
  -H "Content-Type: application/json" \
  -d '{ "company": { "name": "Andes Textiles" }, "health": "ok" }'
```

| Field | Type | Required |
|---|---|---|
| `company_id` | string, non-empty | exactly one of `company_id`/`company`; `404` if the id does not exist |
| `company` | `{ name, contact_emails? }` | exactly one of `company_id`/`company`; resolved via the same find-or-create as `POST /api/companies` |
| `health` | `ok` \| `warning` \| `error` | no, defaults to `ok` |

`201` returns the operation object. `400` → `company_reference_required` (neither or both
of `company_id`/`company` given) or `validation_error`. `404` → `company_not_found`.

### `POST /api/operations/search`

The **only** listing. There used to be a `GET /api/operations` as well, and it was
removed: two routes for the same thing are two contracts to maintain and two places to
fix a filtering bug. The web's filters — free text, status, health, company, date range
and ordering — do not fit in a readable query string, so the one that survives is the
one that can carry all of them.

Every field is optional; an empty body lists everything.

| Field | Type | Behaviour |
|---|---|---|
| `search` | string | case-insensitive substring over the operation id, the company ids and the ports |
| `status` | container state | filters on the **derived** status, in memory |
| `health` | `ok` \| `warning` \| `error` | filtered in Mongo |
| `company_id` | string | the owning company or any party on a booking, in Mongo |
| `from` / `to` | ISO date | range over `created_at` |
| `date` | ISO date | that UTC day; **does not combine** with `from`/`to` |
| `sort_by` | `updatedAt` \| `company` \| `id` | `updatedAt` is derived: the most recent ETA change, or the creation |
| `sort_dir` | `asc` \| `desc` | defaults to `desc` |

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
| `component-created` / `component-updated` | a generated-UI component, same shape as `GET .../components` returns | the component endpoints below, and the agent when a chat turn builds or rewrites a widget |

`simulation-completed` is terminal: the server writes that one event and then closes
the connection (`reply.raw.end()`) — there's nothing left to stream once a script runs
out, so the stream ends instead of sitting open silently forever. A client that wants
to know when an operation's story is "done" watches for this event rather than for the
connection just going quiet.

### `GET /api/operations/:id/components?cols=<2|4|8>`

The generated dashboard of one operation: the widgets and where they go.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8000/api/operations/op-andes-textiles-001/components?cols=4"
```

`200` → `{ "components": [ ... ], "layout": [ { id, col, row, w, h } ] }`. `cols` is
required and must be `2`, `4` or `8` — the layout is **packed on demand** for the column
count you ask for, never stored per breakpoint (see the note further down). `404` →
`operation_not_found`.

A component is `id`, `operation_id`, `kind`, `title?`, `content` (the `ComponentNode[]`
tree), `size`, `priority`, `created_at`. `size` is one of `tile` (1×1), `small` (2×2),
`wide` (4×2), `tall` (2×4), `large` (4×4), `banner` (4×1) — every width divides 2, 4 and
8, which is what makes one packing serve all three column counts.

### `PATCH /api/operations/:id/components/:componentId/placement`

Moves or renames a widget. `{ position?: number, title?: string }`, at least one of the
two, and nothing else — a widget is never resized here. `position` is an index in the
operation's sequence, not a coordinate.

`200` → the component. `404` → `operation_not_found` or `component_not_found`.

### `PATCH /api/operations/:id/components/:componentId`

Rewrites content. Two mutually exclusive body shapes: `{ content: ComponentNode[] }`
replaces the whole tree, `{ path, value }` writes one node in place (this is the surgical
edit the agent's `update_component` skill uses).

`200` → the component, and a `component-updated` event on that operation's SSE stream.
`400` → `invalid_component_content`. `404` → `operation_not_found` or
`component_not_found`.

### `POST /api/operations/:id/components/test-create` · `DELETE /api/operations/:id/components/:componentId`

`test-create` is the manual counterpart to what the agent does — the name says what it is
for. Body: `{ kind, size, children, priority? }`. `201` → the component. `400` →
`invalid_component_tree`. `404` → `operation_not_found`.

`DELETE` removes one widget; the rest keep their relative order and the layout repacks
itself on the next `GET`, which is why there is no cascade to run.

### `POST /api/operations/:id/chat`

The agent. A message goes in, and either a widget comes out on the operation's SSE
stream, or the agent just answers.

```bash
curl -X POST http://127.0.0.1:8000/api/operations/op-andes-textiles-001/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "message": "Show me the containers still in customs" }'
```

| Field | Type | Required |
|---|---|---|
| `message` | string, non-empty | yes |
| `componentIds` | string[], **max 3** | no — the widgets the user is pointing at |

`componentIds` is the `@` button on a widget's header: those components' full content is
handed to the agent, so the user can ask *about* a widget ("what does this chart say?")
or ask for it to be changed ("make this one show weeks instead of days") without
describing it. The cap exists because each one is inlined into the prompt whole.

`201` → `{ "reply": string, "component_created": boolean }`. **The component is not in
this response** — it arrives on `GET /api/operations/:id/events` as `component-created`
or `component-updated`. `component_created: false` means the turn was pure text and
nothing is coming, so the frontend can drop the pending skeleton instead of waiting for a
widget that will never arrive.

`404` → `operation_not_found`. `502` → `invalid_ai_component` (the model produced a tree
that fails validation) or `ai_service_unavailable` (both providers failed).

### `POST /api/operations/:id/webhook`

The same agent on the `auto` trigger: `{ event, payload? }` from an external system
instead of a human. Here a component is **mandatory** — nobody reads a text reply from a
webhook — so a text-only answer is turned into `invalid_ai_component`. The chat-only
`save_company_context` tool is withheld on this trigger, because there is no user to
confirm what is worth remembering.

`202` → the component itself (unlike `chat`, which streams it). Same `404`/`502` codes.

**TODO**: no HMAC or shared secret on this endpoint — see the comment in `ai.routes.ts`.

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

**TODO**: this endpoint is behind the bearer token like the rest, but nothing scopes it
further — any authenticated user can upload onto any operation. The `TODO` comment in
`operations.routes.ts` predates the auth layer and still reads as if there were none.

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

**A labelled line in the body links the email to a company.** This is a convention in
the free text, not a field on this endpoint's payload — Make forwards the raw email as
received, so whoever composes it (a supplier's PO template, a human) is expected to
include a line matching `Company: <name>` (or `Compañía: <name>`), anywhere in
`body_text`, case-insensitive. When present, `<name>` is resolved the same
find-or-create-by-name way as `POST /api/companies` and linked to the operation. An
optional `Contact: <email>` (or `Contacto: <email>`) line sets that company's contact
email on creation; without one, the sender's own address (`from`) is used instead.

```
Orden de compra #OP-ANDES-042
Company: Andes Textiles
Contact: ops@andestextiles.co

Please find the purchase order attached.
```

This link is only ever set **once**, the moment the operation is created from its first
email — a later email in the same thread (or one with no company line at all) never
overwrites it. An email with no matching line leaves the operation without a company,
same as today.

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

If `to` matches one of a company's `contact_emails` and that company is disabled
(`active: false`), the send is blocked before it ever reaches Gmail — `403` →
`company_disabled`. An address that doesn't match any company's contacts (a carrier, a
colleague) always sends; only a recipient we can tie to a known-disabled company is
blocked.

### Errors

Every error response is `{ "error": "<machine_code>", "message": "<human text>" }`.

| Status | `error` | Cause |
|---|---|---|
| `400` | `validation_error` | body, params or querystring failed the zod schema; adds a `details` array |
| `400` | `invalid_filter_combination` | `date` sent together with `from`/`to` |
| `400` | `company_reference_required` | `POST /api/operations` sent with neither `company_id` nor `company` |
| `400` | `invalid_component_content` | a content `PATCH` whose path or tree does not validate |
| `400` | `invalid_component_tree` | `test-create` given a children tree that does not validate |
| `401` | `unauthorized` | bearer token missing, invalid or expired |
| `401` | `invalid_credentials` | wrong email/password, or an unusable refresh token |
| `403` | `forbidden` | a non-superadmin reaching outside its own company, or minting a superadmin |
| `404` | `operation_not_found` | no operation with that id |
| `404` | `company_not_found` | no company with that id |
| `404` | `component_not_found` | no component with that id on that operation |
| `404` | `user_not_found` | no user with that id |
| `404` | `document_not_found` | no document with that id on that operation |
| `404` | `booking_not_found` | no booking with that id on that operation |
| `404` | `container_not_found` | no container with that id on that booking |
| `409` | `company_name_conflict` | `PATCH /api/companies/:id` renamed to a name another company already has |
| `409` | `email_conflict` | `POST /api/users` with an email that already exists |
| `403` | `company_disabled` | `POST /api/emails/send` targeted a disabled company's contact email |
| `502` | `email_send_failed` | SMTP rejected the message |
| `502` | `document_upload_failed` | Supabase Storage rejected the upload |
| `502` | `invalid_ai_component` | the model returned a component tree that fails validation |
| `502` | `ai_service_unavailable` | OpenAI **and** the Gemini fallback both failed |

## Things the code will not tell you at a glance

**A widget's position is its place in a sequence, not a pair of coordinates.**
`Component.order` is what the user controls by dragging; `col`/`row` are packed from that
order for whatever column count is asked for, so one arrangement serves every screen
width and nothing has to be stored per breakpoint. Widgets can be moved and renamed
(`Component.title` overrides the name the agent generated) but never resized: the size
comes from `Component.size` alone.

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

**The agent's prompt is assembled at boot from Markdown, not from TypeScript.**
`composition.ts` reads `src/application/prompts/ari-system-prompt.md` and every
`src/application/skills/*.skill.md`, and concatenates them. A skill is not a separate
file the model is told about: it is the prose that ships **with** the command it
documents, glued onto the system prompt in the same pass that registers the tool. That is
why `src/application/{prompts,skills}` is copied straight into the runtime Docker stage —
`.md` never goes through `tsc`, so `dist/` alone is not enough to boot.

**Tools are a registry, not a switch statement.** `CommandRegistry` holds `create_component`,
`update_component` and `save_company_context`; each carries a JSON Schema that is both
what the model is handed and what validates the model's answer before it executes.
Adding a tool is registering one `Command` — nothing in the use case knows their names,
with one exception it states out loud: `save_company_context` is filtered out on the
`auto` trigger.

**Two AI providers, one port, an ordered fallback.** `FallbackAiCompletionAdapter` tries
OpenAI and drops to Gemini when it throws; only both failing surfaces as
`ai_service_unavailable`. Both SDKs throw at *construction* on a falsy API key, so the
composition root passes a placeholder string when the env var is missing — boot survives
without a key and the failure shows up as a normal auth error on the first real call,
instead of a crash at startup.

**Chat history is in memory, keyed by operation.** `InMemoryChatHistoryStore` is what
gives the agent continuity across turns on the same operation; restarting the API forgets
every thread. Same for the simulation registry. Nothing about the agent's memory is
persisted yet.

**The agent finds a component by its label, not by its id.** The user says "the ETA
widget", never `cmp-7f3a`. Every existing component is offered to the model as
`{ id, label, size, childCount }` — `componentLabel()` derives that label the same way the
UI does — and the model picks one and passes its `id` back. The instruction is
deliberately conservative: when more than one matches, or nothing does, it creates rather
than overwrites.

**HTTP endpoints have no integration tests.** Tests are unit tests over the domain and
the use cases, with an in-memory repository as the double; endpoints are verified
manually with Postman.
