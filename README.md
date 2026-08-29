# Sispaniers-InteractiveUI

**The scenario: AI-powered logistics automation.** AI agents read importers' and exporters' emails and documents, track containers, detect problems and execute actions — and humans supervise them.

## Key definitions

**The logistics domain:**

- **Client:** importer/exporter company using the platform
- **Logistics operation:** a shipment — groups purchase orders, containers and documents
- **Booking:** the reservation of space on a vessel to transport containers; confirmed by the shipping line
- **Container:** the physical unit tracked from origin to destination
- **ETD / ETA:** estimated time of departure / arrival of the shipment
- **Container states:** booking confirmed → in transit → arrived at port → customs → delivered
- **Documents:** Purchase Order (PO: the client's order to its supplier) · Booking Confirmation (the carrier confirms vessel, route, dates) · Bill of Lading (BL: the transport contract; identifies the shipment) · Invoice / Packing List (commercial invoice and cargo detail) · Arrival Notice (notice of arrival at destination port)

**The agents:**

- **Agent:** an AI system that executes work autonomously using tools — it doesn't just chat, it does
- **Flow (workflow):** the sequence of steps and decisions an agent executes when a trigger fires
- **Trigger:** the event that starts a flow (an email arrives, an ETA changes, a scheduled time)
- **Run:** one individual execution of a flow; the same flow runs many times
- **Human-in-the-loop:** a point in the flow where a human must review, approve or decide

## 1. The problem

Agents run flows that make real decisions: they review documents, detect delays, escalate problems, notify clients. But the humans supervising those agents don't necessarily understand how these systems work, and they are used to seeing the world through interfaces that:

- Were **designed** for scenarios someone anticipated
- Require **frontend work** every time a new flow is born
- **Can't show the unexpected**: when the agent hits a rare case, the screen doesn't exist

The result: humans blind in front of agents that are working; slow, out-of-context decisions and approvals; and the frontend becomes **the bottleneck of automation** when it comes to end-user trust and adoption.

## 2. Objective

Build a system where **an agent executing a flow generates and renders its own interface (UI/front) in real time**:

- ☐ The UI **is born from the flow's state** and the decisions the agent makes along the way, not from predefined screens
- ☐ The UI is **alive inside a single run**: as the flow advances step by step, the interface restructures itself in real time — streaming while the agent works, not a refresh when the run ends
- ☐ The UI **evolves with each run**: the agent executes, the interface changes
- ☐ If the flow **changes**, the interface **changes**
- ☐ It is **bidirectional and interactive, in the same run**: what the human answers in the generated UI goes back to the agent, changes what it does next, and the interface immediately renders the consequence of that decision — a full round-trip, not a rendered report

> **Trial by fire.** The judges will modify the flow live (add a step, change a decision) — the interface must adapt on its own.

## 3. Expected results

A demo or prototype showing:

- ☐ An agent executing a flow with visible decisions
- ☐ An interface **generated at runtime** that reflects the state of the flow
- ☐ The interface **restructuring itself live mid-run** as the agent moves through the flow — the audience watches it change while the agent works
- ☐ Successive agent runs → **the interface updates itself with each run**
- ☐ A **human-in-the-loop** moment resolved through a generated interface (approve, choose, correct) — and the agent **visibly changes course because of it**, with the UI showing the consequence
- ☐ The flow modified → **the interface adapts with no manual work**

### Bonus points

- Visual coherence: the generated UI respects a design system — it isn't a collage
- Several flows running at once, each with its own interface
- Security: what an agent-generated UI can and cannot do

## 4. Minimal fictional case

- **Company:** "Muebles del Sur", an importer bringing furniture from Vietnam to Mexico.
- **Agent:** *Ari* — manages the company's bookings and monitors its shipments.

**Base flow:**

1. **Trigger:** an email arrives with a Booking Confirmation
2. Ari extracts the data: carrier, vessel, origin/destination port, ETD/ETA, containers
3. Creates the operation and monitors the voyage on every run
4. If it detects a serious problem → a human decides in the same interface

**Key moments (every run changes the front):**

1. **Run 1 — booking confirmed** → the interface is born: a **map with the route** (Vietnam → Mexico), the booking card and its containers
2. **Run 2 — the vessel departs** → the front changes by itself: vessel position on the map, containers in transit
3. **Run 3 — unexpected transshipment** (the vessel makes an unplanned stop and the ETA slips 9 days) → the map **redraws the route** and the interface generates a human-in-the-loop decision panel: *wait, look for an alternative, or notify the end client?*
4. **The trial** → add a new step to the flow (e.g. "validate the Bill of Lading against the booking before confirming") and the interface must reflect it on its own

Employees, emails, documents, vessels and data can all be invented.

## Structure

```
frontend/    # runtime-generated UI
backend/     # agents, flows and orchestration
.githooks/   # versioned git hooks, shared by every clone
```

## Getting started

```bash
cd backend
make install     # uv sync --all-groups
make hooks       # REQUIRED once per clone — see below
make dev         # API on http://127.0.0.1:8000
```

### Enable the git hooks — once per clone

Git hooks live in `.git/hooks/`, which is **never committed**. Cloning the repo does not
give you the hooks; every contributor has to opt in once:

```bash
make -C backend hooks
```

That points `core.hooksPath` at the versioned `.githooks/` directory. From then on
`git commit` runs `make -C backend check` automatically whenever the commit touches
`backend/`, so lint, types and tests are verified before the commit is created. To skip
it in a genuine emergency: `git commit --no-verify`.

Verify it is active with `git config core.hooksPath` — it should print `.githooks`.

### Validation

One definition of "valid", three ways to reach it. The `Makefile` owns the commands;
the pre-commit hook and CI both call it, so they can never drift apart.

| Where | Command | When |
|---|---|---|
| Locally, on demand | `make check` | whenever you want |
| Locally, on commit | the pre-commit hook, calling `make check` | `git commit` |
| CI | `make lint types build test smoke` | push to `main`, every PR |

`make ci` reproduces the full CI sequence locally.
