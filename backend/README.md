# Sispaniers InteractiveUI — Backend

Hexagonal (ports & adapters) scaffolding on Node.js + TypeScript + Fastify. The layers
are empty on purpose: only the wiring, the tooling and the pipeline are in place.

```
src/
  domain/
    model/          entities and value objects — plain TypeScript, no dependencies
    ports/          inbound (driving) and outbound (driven) contracts
  application/
    use-cases/      orchestration; depends only on domain ports
  infrastructure/
    adapters/
      inbound/http/ Fastify routes, schemas and the app factory
      outbound/     repositories and gateways
    config/         composition root — the only place that wires concretes
  main.ts           process entry point
scripts/smoke.ts    boots the built API and probes /health
```

The dependency rule: `domain` imports nothing from `application` or `infrastructure`,
and never a framework. `application` imports only `domain`.

## Commands

```bash
make install   # pnpm install
make check     # lint + types + tests
make test      # vitest
make dev       # API with autoreload on http://127.0.0.1:8000
make smoke     # build, boot the compiled app and probe /health
make ci        # the exact sequence CI runs
```

Health probe at `/health`.

## Notes

The project is ESM with `moduleResolution: NodeNext`, so relative imports carry a `.js`
extension even in `.ts` files. That is correct, not a typo.
