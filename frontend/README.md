# Yuno × Nauta — Front-end base

Front-end for **Module 05** (Yuno × Nauta hackathon, 30 August 2026): a console
where AI agents run logistics flows and humans supervise them.

The main screen is the **operations grid** — everything the agents are working
on right now. Open one and the others stay visible in a rail on the left, so you
can jump between them and notice a change in one while working on another.

It runs against the Sispaniers backend API.

---

## Quick start

```bash
# 1. Install dependencies (Node 22, pnpm 8.15 — `corepack enable`)
pnpm install

# 2. Create your local env file
cp .env.example .env

# 3. Run it
pnpm dev
```

Open **http://localhost:5173**.

Sign in with a seeded backend user — `admin@sispaniers.com` / `sispaniers-dev` is the
superadmin that sees every company. The rest are in `backend/scripts/seed-data.json`.

---

## Commands

| Command           | What it does                                                        |
| ----------------- | ------------------------------------------------------------------- |
| `pnpm dev`        | Dev server with HMR at `http://localhost:5173`                       |
| `pnpm build`      | Type-checks (`tsc -b`) and builds to `dist/`                         |
| `pnpm preview`    | Serves the production build locally — **use this to rehearse the demo** |
| `pnpm lint`       | Runs oxlint                                                          |
| `pnpm typecheck`  | Type-check only, no build                                            |

Useful variations:

```bash
pnpm dev --host          # expose on the LAN (demo from a phone at the venue)
pnpm dev --port 3000     # different port
pnpm preview --host      # production build, reachable on the LAN
```

---

## Backend API

```bash
VITE_API_URL=https://the-real-backend/api
```

If the backend runs locally and CORS is in the way, use the dev proxy instead:

```bash
VITE_API_URL=/api
VITE_API_PROXY=http://localhost:8000
```

---

## What is already built

**Design system** — one palette (Manifiesto: violet = the machine's voice,
solid violet = your turn) × 2 themes × 3 locales, switchable at runtime.
Everything in `rem`, nothing hardcoded. See `src/styles/brands.css` for the
semantic rule behind the colours — it matters more than the hex values.

**Auth + RBAC** — three ordered roles (`user` < `admin` < `superadmin`), granular
permissions, route guards that run *before* the component mounts, session refresh
without a stampede, cross-tab sign-out. The roles mirror the backend's exactly; the
client-side matrix is UX, the real enforcement is server-side.

**The agent chat** — every operation has a conversation with Ari
(`components/operations/AgentChat.tsx`). A message can point at up to three widgets on
the board (the `@` button on a widget header), so the user can ask about one or ask for
it to be changed without describing it. A turn either builds a widget or just answers —
the response says which, so a pending skeleton is never left waiting on a widget that
isn't coming.

**Runtime-generated widgets** — `components/generated/` renders the agent's component
trees into the dashboard grid: `nodeFactory` maps each node kind to a real component,
`WidgetGrid` places them, and a kind the frontend doesn't know renders as a visible
`Unknown` block showing the raw node — the backend adding a node kind is then obvious on
screen instead of a silently empty card. Widgets arrive live over SSE (`hooks/useSse.ts`, `hooks/useOperationEvents.ts`) —
`fetch` with an `AbortController`, not `EventSource`, because the stream needs an
`Authorization` header.

**HTTP layer** — one axios instance with retries and exponential backoff,
normalized errors, correlation ids, and **zod validation on every response**.

**Components** — buttons, inputs, tables, modals, charts, states. All four
states (loading / error / empty / no-results) are real, everywhere.

**i18n** — Spanish, English and Brazilian Portuguese. No user-facing string is
hardcoded in a component.

Open **`/components`** in development: a live catalogue of everything, where you
can check all 6 theme × locale combinations at a glance.

---

## Project structure

```
src/
├─ api/              HTTP layer: client, endpoints, normalized errors, query client
├─ auth/             session store, RBAC, token storage
├─ schemas/          ⭐ every zod schema — the data contract of the app
├─ i18n/             i18next setup + locales/{es,en,pt-BR}
├─ router/           TanStack Router route tree + guards
├─ components/
│  ├─ ui/            design system primitives
│  ├─ operations/    the domain: card, rail, filters, agent chat, generated surface
│  ├─ generated/     ⭐ the agent's component trees → real React (nodeFactory, WidgetGrid)
│  ├─ charts/        chart wrappers with a validated palette
│  ├─ companies/     company directory and forms
│  ├─ users/         user administration, scoped by role
│  ├─ layout/        shell, sidebar, topbar, page header
│  └─ feedback/      error boundary, error / empty / loading states
├─ pages/            screens
├─ hooks/            useSse, useOperationEvents, useMediaQuery, useDebounce…
├─ lib/              framework-free helpers
├─ stores/           theme store (theme, density)
├─ styles/           design tokens and the Manifiesto palette
└─ config/           validated env, navigation
```

Four files are worth reading first, because they explain most of the rest:

- **`src/styles/brands.css`** — the palette, and above all the *semantic rule*
  behind it: violet is the machine's voice (tinted when the agent asserts, solid
  when it asks), and green/amber/red belong to the cargo, never to the agent.
  That rule matters more than the hex values.
- **`src/schemas/operation.schema.ts`** — the domain, and why status and health
  are two separate axes
- **`src/router/router.tsx`** — why the operations rail lives in a *layout*
  route, which is what keeps the other operations visible without flicker
- **`src/auth/roles.ts`** — the permission matrix, and why client-side
  permissions are UX and not security
- **`src/components/generated/nodeFactory.tsx`** — the seam where the agent's JSON
  becomes React, and what happens to a node kind this build has never seen

---

## Stack

| Choice                 | Why                                                                      |
| ---------------------- | ------------------------------------------------------------------------ |
| Vite + React 19 + TS   | Fastest feedback loop; the whole team already knows it                   |
| Tailwind v4            | CSS-first tokens: `@theme` makes the design system *be* the CSS          |
| TanStack Router        | Search params typed and validated with zod; guards before render         |
| TanStack Query         | Cache, refetch on focus, invalidation — survives the live stress test    |
| TanStack Table         | Headless: it owns table state, we own every pixel                        |
| TanStack Form          | Takes the zod schema directly, no resolver adapter                       |
| Zustand                | Auth state readable from outside React (interceptors, route guards)      |
| Zod                    | Runtime validation at the network boundary                               |
| Recharts               | Charts with a validated, colour-blind-safe palette                       |
| i18next                | es / en / pt-BR from day one                                             |

Every decision, with the alternatives we discarded and why, is in
**[`docs/DECISIONS.md`](docs/DECISIONS.md)**.

---

## Environment variables

All of them are optional — `.env.example` has working defaults. The ones that
matter:

| Variable            | Default         | What it does                                          |
| ------------------- | --------------- | ----------------------------------------------------- |
| `VITE_API_URL`      | `/api`          | Backend base URL                                      |
| `VITE_API_PROXY`    | —               | Dev proxy target; kills CORS in development           |
| `VITE_API_TIMEOUT`  | `15000`         | Per-request timeout in ms                             |
| `VITE_THEME`        | `light`         | `light` \| `dark` \| `system`                         |
| `VITE_LOCALE`       | —               | `es` \| `en` \| `pt-BR`; empty means detect           |
| `VITE_AUTH_STORAGE` | `localStorage`  | `localStorage` \| `sessionStorage` \| `memory`        |
| `VITE_DEVTOOLS`     | `false`         | Query and Router devtools panels                      |

Only `VITE_`-prefixed variables reach the browser, which means **they are all
public**. Never put a secret here.

---

## Troubleshooting

**Blank page after `pnpm dev`** — open the console. If it says the env is
invalid, you are missing `.env`: run `cp .env.example .env`.

**Port 5173 in use** — `pnpm dev --port 3000`, or set `VITE_PORT` in `.env`.

**Types complaining after pulling** — `pnpm install && pnpm typecheck`. The
build info is cached in `node_modules/.tmp`; deleting that folder forces a
clean type-check.

**Fonts look wrong** — they are served from `node_modules` via Fontsource, not
from Google Fonts, precisely so the venue wifi cannot break the demo. If they
fail, `pnpm install` did not finish.
