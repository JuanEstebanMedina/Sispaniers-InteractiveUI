# Yuno × Nauta — Front-end base

Front-end for **Module 05** (Yuno × Nauta hackathon, 30 August 2026): a console
where AI agents run logistics flows and humans supervise them.

The main screen is the **operations grid** — everything the agents are working
on right now. Open one and the others stay visible in a rail on the left, so you
can jump between them and notice a change in one while working on another.

It runs end to end **without a backend** — a Service Worker answers real HTTP
requests — and switches to the real API by changing one environment variable.

---

## Quick start

```bash
# 1. Install dependencies (pnpm 8+, Node 20+)
pnpm install

# 2. Create your local env file
cp .env.example .env

# 3. Run it
pnpm dev
```

Open **http://localhost:5173**.

Sign in with any of the demo accounts — they are listed on the login screen and
fill themselves in with one click:

| Email                  | Password   | Role          | What they can do                       |
| ---------------------- | ---------- | ------------- | -------------------------------------- |
| `admin@yuno.com`       | `demo1234` | Administrator | Everything                             |
| `supervisor@yuno.com`  | `demo1234` | Supervisor    | Answer agent decisions, users, settings |
| `operator@nauta.com`   | `demo1234` | Operator      | Create and update operations           |
| `analyst@nauta.com`    | `demo1234` | Analyst       | Read-only + the AI assistant           |
| `guest@yuno.com`       | `demo1234` | Guest         | Read-only                              |

> Sign in as **operator** and then as **supervisor**: only the supervisor can
> answer what an agent is asking (`operations:decide`). That is the RBAC
> working, not a mock — and it is the one permission boundary that matters,
> because answering an agent redirects an automated flow and is signed by whoever
> gave the answer.

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

## Connecting the real backend

This is the whole procedure. There is no refactor.

```bash
# .env
VITE_USE_MOCKS=false
VITE_API_URL=https://the-real-backend/api
```

If the backend runs locally and CORS is in the way, use the dev proxy instead:

```bash
# .env
VITE_USE_MOCKS=false
VITE_API_URL=/api
VITE_API_PROXY=http://localhost:8000
```

**Hybrid mode** — the one that actually gets used at 3 AM. Mocks are configured
with `onUnhandledRequest: 'bypass'`, so any endpoint without a handler falls
through to the real server. You can wire real endpoints one at a time as the
backend delivers them, while the rest stays mocked. Delete a handler from
`src/mocks/handlers.ts` and that endpoint goes live.

---

## What is already built

**Design system** — one palette (Manifiesto: violet = the machine's voice,
solid violet = your turn) × 2 themes × 3 locales, switchable at runtime.
Everything in `rem`, nothing hardcoded. See `src/styles/brands.css` for the
semantic rule behind the colours — it matters more than the hex values.

**Auth + RBAC** — 5 roles, granular permissions, route guards that run *before*
the component mounts, session refresh without a stampede, cross-tab sign-out.

**HTTP layer** — one axios instance with retries and exponential backoff,
normalized errors, correlation ids, and **zod validation on every response**.

**Components** — buttons, inputs, tables, modals, charts, states. All four
states (loading / error / empty / no-results) are real, everywhere.

**i18n** — Spanish, English and Brazilian Portuguese. No user-facing string is
hardcoded in a component.

**Mock backend** — 24 operations, deterministic, including the ugly cases:
three different pending decisions, one stuck in customs, one in exception, and a
company name long enough to break a narrow card.

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
│  ├─ operations/    the domain: card, rail, filters, generated surface
│  ├─ charts/        chart wrappers with a validated palette
│  ├─ layout/        shell, sidebar, topbar, page header
│  └─ feedback/      error boundary, error / empty / loading states
├─ pages/            screens
├─ hooks/            useMediaQuery, useDebounce, useDisclosure, useHotkey…
├─ stores/           theme store (theme, density)
├─ styles/           design tokens and the Manifiesto palette
├─ mocks/            MSW: handlers + seeded data
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
| MSW                    | A real mock server, so the app code never knows it is mocked             |
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
| `VITE_USE_MOCKS`    | `true`          | `false` → hits the real backend                       |
| `VITE_API_URL`      | `/api`          | Backend base URL                                      |
| `VITE_API_PROXY`    | —               | Dev proxy target; kills CORS in development           |
| `VITE_THEME`        | `dark`          | `light` \| `dark` \| `system`                         |
| `VITE_DEMO_MODE`    | `true`          | Prefills login credentials so nobody types on stage   |
| `VITE_DEVTOOLS`     | `true`          | Query and Router devtools panels                      |
| `VITE_MOCK_DELAY`   | `320`           | Artificial mock latency, so skeletons are visible     |

Only `VITE_`-prefixed variables reach the browser, which means **they are all
public**. Never put a secret here.

---

## Troubleshooting

**Blank page after `pnpm dev`** — open the console. If it says the env is
invalid, you are missing `.env`: run `cp .env.example .env`.

**Mocks not intercepting** — `public/mockServiceWorker.js` must exist. If it
does not: `npx msw init public/`.

**Port 5173 in use** — `pnpm dev --port 3000`, or set `VITE_PORT` in `.env`.

**Types complaining after pulling** — `pnpm install && pnpm typecheck`. The
build info is cached in `node_modules/.tmp`; deleting that folder forces a
clean type-check.

**Fonts look wrong** — they are served from `node_modules` via Fontsource, not
from Google Fonts, precisely so the venue wifi cannot break the demo. If they
fail, `pnpm install` did not finish.
