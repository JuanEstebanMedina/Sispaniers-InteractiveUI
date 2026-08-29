.DEFAULT_GOAL := help

install: ## Install dependencies
	pnpm install

format: ## Format and autofix the codebase
	pnpm run format

lint: ## Lint and check formatting
	pnpm run lint

types: ## Static type check
	pnpm run typecheck

build: ## Compile TypeScript to dist/
	pnpm run build

test: ## Run the test suite
	pnpm run test

check: lint types test ## Everything CI runs, minus build and smoke

dev: ## Run the API with autoreload
	pnpm run dev

seed: ## Fill the running mongo with synthetic operations
	pnpm run seed

smoke: build ## Boot the built API and probe /health
	pnpm run smoke

ci: install lint types build test smoke ## The exact sequence CI runs

hooks: ## Enable the versioned git hooks in this clone
	git -C .. config core.hooksPath .githooks
	@echo "pre-commit hook enabled"

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-10s\033[0m %s\n", $$1, $$2}'

.PHONY: install format lint types build test check ci dev seed smoke hooks help
