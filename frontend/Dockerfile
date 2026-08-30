FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-frontend,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

ARG VITE_API_URL=/api
ARG VITE_USE_MOCKS=false
ARG VITE_DEMO_MODE=true
ARG VITE_API_TIMEOUT=15000
ARG VITE_MOCK_DELAY=320
ARG VITE_THEME=light
ARG VITE_APP_NAME=Sispaniers
ARG VITE_AUTH_STORAGE=localStorage
ARG VITE_DEVTOOLS=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_USE_MOCKS=$VITE_USE_MOCKS
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
ENV VITE_API_TIMEOUT=$VITE_API_TIMEOUT
ENV VITE_MOCK_DELAY=$VITE_MOCK_DELAY
ENV VITE_THEME=$VITE_THEME
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_AUTH_STORAGE=$VITE_AUTH_STORAGE
ENV VITE_DEVTOOLS=$VITE_DEVTOOLS

RUN pnpm run build


FROM nginx:1-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
