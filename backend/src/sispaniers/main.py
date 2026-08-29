from fastapi import FastAPI

from sispaniers.infrastructure.config.composition import create_app

app: FastAPI = create_app()
