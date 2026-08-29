# Sispaniers InteractiveUI — Backend

Hexagonal (ports & adapters) scaffolding on FastAPI + uv. The layers are empty on
purpose: only the wiring, the tooling and the pipeline are in place.

```
src/sispaniers/
  domain/
    model/          entities and value objects — pure Python, no dependencies
    ports/          inbound (driving) and outbound (driven) contracts
  application/
    use_cases/      orchestration; depends only on domain ports
  infrastructure/
    adapters/
      inbound/http/ FastAPI routes, schemas and the app factory
      outbound/     repositories and gateways
    config/         composition root — the only place that wires concretes
  main.py           ASGI entry point
scripts/smoke.py    boots the API and probes /health
```

The dependency rule: `domain` imports nothing from `application` or `infrastructure`,
and never a framework. `application` imports only `domain`.

## Commands

```bash
make install   # uv sync --all-groups
make check     # lint + format check + types + tests
make test      # pytest
make dev       # API with autoreload on http://127.0.0.1:8000
make smoke     # boot the API and probe /health
```

Interactive API docs at `/docs`, health probe at `/health`.
