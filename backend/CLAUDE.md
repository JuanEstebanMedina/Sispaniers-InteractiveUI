# Backend — working agreement

TypeScript service on Node.js, hexagonal architecture, managed with `pnpm`. Read this
before changing anything under `backend/`.

## Tooling

| Concern | Tool |
|---|---|
| Runtime | Node.js 22 |
| Package manager | pnpm (pinned via `packageManager` in `package.json`) |
| Lint + format | Biome |
| Types | `tsc` in strict mode |
| Tests | Vitest |
| HTTP | Fastify |

`pnpm-lock.yaml` is committed and authoritative. CI installs with `--frozen-lockfile`
and fails if the lock does not match `package.json`. If you change a dependency, commit
the updated lockfile in the same change.

The project is ESM (`"type": "module"`) with `moduleResolution: NodeNext`, so **relative
imports must carry a `.js` extension** even though the source file is `.ts`. Biome's
`useImportExtensions` rule enforces this.

## The three validation layers — do not confuse them

| Layer | Runs when | Triggered by |
|---|---|---|
| `Makefile` | you type `make <target>` | a human, locally |
| `.githooks/pre-commit` | `git commit` touching `backend/` | git, locally |
| `.github/workflows/ci.yml` | every push to `main`, every PR | GitHub |

The hook and CI do not define their own commands: both call the Makefile. Enabling the
hook is a per-clone opt-in (`make hooks`), because `.git/hooks/` is never committed.

## Mandatory gates

Every one of these must pass before a change is considered done. They are not optional
and none of them may be skipped, weakened or excluded with a blanket ignore:

| Gate | Command | What it protects |
|---|---|---|
| Lint + format | `make lint` | dead code, unused imports, one formatting |
| Types | `make types` | the contract between every layer |
| Build | `make build` | the service compiles to `dist/` |
| Tests | `make test` | behaviour |
| Smoke run | `make smoke` | the built app boots and answers `/health` |

`make check` runs lint, types and tests in one go. Run it before every commit.

A clean `tsc` is not proof the app starts. The smoke run exists because it boots the
compiled output for real and demands a `200`. Keep it that way.

`tsc` is the compiler, not a linter. A `// @ts-ignore`, an `any`, or a cast that silences
it is a defect in the design, not a fix. Model the type properly instead.

## Single source of truth — this is the important one

**The Makefile owns the commands. Nothing else may restate them.** The pre-commit hook
calls `make check`; CI calls `make lint`, `make types`, `make build`, `make test` and
`make smoke`. Neither one spells out `pnpm run ...` on its own.

A pipeline that does something you cannot reproduce locally is a slot machine: push,
wait, read logs, guess, repeat. Three copies of the command list guarantee exactly that,
because they drift.

To add a validation:

1. add a script to `package.json`
2. add a target to `Makefile` that calls it
3. add it to the `check` and/or `ci` aggregate targets
4. add a CI step that **calls that target**

Copying the raw command into `ci.yml` or into a hook is a defect, not a shortcut.

The CI job is named `Backend`. The `main` branch ruleset requires that exact status
check by name — renaming the job blocks every pull request from merging.

## Architecture rule

Dependencies point inward, always:

```
infrastructure  →  application  →  domain
```

- `domain/` imports nothing from `application/` or `infrastructure/`, and never a
  framework (no Fastify, no database driver). Plain TypeScript only.
- `application/` imports only `domain/`.
- `infrastructure/` is the only layer allowed to know about frameworks, I/O and
  transport.
- `infrastructure/config/composition.ts` is the composition root: the single place where
  concrete implementations are wired to ports. Nothing else instantiates an adapter.

Ports are declared in `domain/ports/` as plain `interface` or `type` declarations:
inbound ports are what drives the application, outbound ports are what the application
drives. TypeScript's structural typing means an adapter satisfies a port by shape — it
never needs to import and extend a base class.

## Tests

- `tests/unit/` — domain and use cases, no I/O, no HTTP.
- `tests/integration/` — adapters through the real app built by `createApp()`, driven
  with Fastify's `app.inject()` rather than a real socket.
- Tests are written before the implementation, and each one names the behaviour it
  protects, not the function it calls.
