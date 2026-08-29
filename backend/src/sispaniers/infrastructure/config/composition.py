from fastapi import FastAPI

from sispaniers.infrastructure.adapters.inbound.http.app import build_app


def create_app() -> FastAPI:
    return build_app()
