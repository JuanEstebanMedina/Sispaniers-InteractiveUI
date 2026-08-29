.DEFAULT_GOAL := help

install: ## Install dependencies into .venv
	uv sync --all-groups

format: ## Format the codebase
	uv run ruff format .

lint: ## Lint and check formatting
	uv run ruff check .
	uv run ruff format --check .

types: ## Static type check
	uv run mypy

test: ## Run the test suite
	uv run pytest

build: ## Build the distributable package
	uv build

check: lint types test ## Everything CI runs, minus build and smoke

dev: ## Run the API with autoreload
	uv run uvicorn sispaniers.main:app --reload --port 8000

smoke: ## Boot the API and probe /health
	uv run python -m scripts.smoke

ci: install lint types build test smoke ## The exact sequence CI runs

hooks: ## Enable the versioned git hooks in this clone
	git -C .. config core.hooksPath .githooks
	@echo "pre-commit hook enabled"

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-10s\033[0m %s\n", $$1, $$2}'

.PHONY: install format lint types build test check ci dev smoke hooks help
