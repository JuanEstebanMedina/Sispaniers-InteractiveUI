from fastapi import FastAPI


def build_app() -> FastAPI:
    app = FastAPI(title="Sispaniers InteractiveUI", version="0.1.0")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
