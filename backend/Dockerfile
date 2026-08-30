FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm run build


FROM build AS seed

CMD ["pnpm", "run", "seed"]


FROM build AS builder

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

# `composition.ts` lee el prompt del agente desde `src/` en tiempo de ejecución
# porque tsc no copia los .md a dist/. Mientras eso siga así, la imagen tiene
# que llevar ese .md o el proceso muere al arrancar.
COPY --from=builder --chown=node:node /app/src/application/prompts ./src/application/prompts

USER node

EXPOSE 8000

CMD ["node", "dist/main.js"]
