# Values come from the env files, never from the surrounding shell.
#
# Compose lets an exported variable win over --env-file, so a stray
# `source backend/.env.example` in the terminal silently replaces the real
# Mongo password with its placeholder and the backend dies unable to
# authenticate. Scrubbing the names compose interpolates keeps the env files
# the only source of truth.
ENV_FILES := --env-file backend/.env --env-file frontend/.env
COMPOSE := env -u MONGO_USER -u MONGO_PASSWORD -u MONGO_DB -u MONGO_PORT \
	-u BACKEND_PORT -u FRONTEND_PORT docker compose $(ENV_FILES)

.PHONY: up up-build down logs ps config backend

up:
	$(COMPOSE) up -d

up-build:
	$(COMPOSE) up -d --build

## mongo + backend only, for running the frontend with Vite on the host
backend:
	$(COMPOSE) up -d mongo backend

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

## Prints the resolved values. A placeholder here means the shell leaked in.
config:
	$(COMPOSE) config | grep -E 'MONGODB_URI|_PORT:'
