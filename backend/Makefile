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

check: lint types test ## Everything CI runs, minus the smoke run

dev: ## Run the API with autoreload
	uv run uvicorn sispaniers.main:app --reload --port 8000

smoke: ## Boot the API and probe /health
	uv run python -m scripts.smoke

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-10s\033[0m %s\n", $$1, $$2}'

.PHONY: install format lint types test check dev smoke help
