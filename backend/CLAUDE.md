# Backend — working agreement

Python service, hexagonal architecture, managed with `uv`. Read this before changing
anything under `backend/`.

## Tooling

Never call `python`, `pip`, `pytest`, `ruff` or `mypy` directly. Every command goes
through `uv run`, so it resolves against the locked environment:

```bash
uv sync --all-groups   # install
uv run <command>       # anything else
```

`uv.lock` is committed and authoritative. CI installs with `--locked` and fails if the
lock does not match `pyproject.toml`. If you change a dependency, run `uv lock` and
commit the result in the same change.

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
| Lint | `uv run ruff check .` | dead code, unused imports, import order |
| Format | `uv run ruff format --check .` | one formatting, zero diff noise |
| Types | `uv run mypy` | Python does not compile — strict typing is the compiler |
| Build | `uv build` | the package is importable and installable |
| Tests | `uv run pytest` | behaviour |
| Smoke run | `uv run python -m scripts.smoke` | the app actually boots and answers `/health` |

`make check` runs lint, format, types and tests in one go. Run it before every commit.

A green import is not proof the app starts. The smoke run exists because it boots
uvicorn for real and demands a `200`. Keep it that way.

## Single source of truth — this is the important one

**The Makefile owns the commands. Nothing else may restate them.** The pre-commit hook
calls `make check`; CI calls `make lint`, `make types`, `make build`, `make test` and
`make smoke`. Neither one spells out `uv run ruff ...` on its own.

A pipeline that does something you cannot reproduce locally is a slot machine: push,
wait, read logs, guess, repeat. Three copies of the command list guarantee exactly that,
because they drift.

To add a validation:

1. add a target to `Makefile`
2. add it to the `check` and/or `ci` aggregate targets
3. add a CI step that **calls that target**

Copying the raw command into `ci.yml` or into a hook is a defect, not a shortcut.

## Architecture rule

Dependencies point inward, always:

```
infrastructure  →  application  →  domain
```

- `domain/` imports nothing from `application/` or `infrastructure/`, and never a
  framework (no FastAPI, no pydantic, no httpx). Pure Python only.
- `application/` imports only `domain/`.
- `infrastructure/` is the only layer allowed to know about frameworks, I/O and
  transport.
- `infrastructure/config/composition.py` is the composition root: the single place
  where concrete implementations are wired to ports. Nothing else instantiates an
  adapter.

Ports are declared in `domain/ports/`: inbound ports are what drives the application,
outbound ports are what the application drives.

## Tests

- `tests/unit/` — domain and use cases, no I/O, no ASGI client.
- `tests/integration/` — adapters through the real app built by `create_app()`.
- Tests are written before the implementation, and each one names the behaviour it
  protects, not the function it calls.
