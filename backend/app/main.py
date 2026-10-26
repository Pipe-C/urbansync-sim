"""Application factory.

A factory rather than a module-level `app` because tests build their own
instance with overridden dependencies, and because the socket server wraps the
FastAPI app — the order of that wrapping is decided in `backend/main.py`, the
process entry point, not here.
"""

from fastapi import FastAPI

from app.api.routes import auth, configs, health, reports, sessions
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="UrbanSync Sim API",
        version="0.1.0",
        summary="Adaptive traffic control and emergency preemption.",
        # The interactive docs are a development surface. Production hides them
        # unless someone deliberately turns them back on.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    # CORS: the frontend on `localhost:5173` plus any Vercel preview host. The
    # list and the regex come from settings so a deployment can widen them
    # without a code change.
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(configs.router)
    app.include_router(sessions.router)
    app.include_router(reports.router)

    return app
