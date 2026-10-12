"""The Lumen API."""

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import get_settings
from .deps import Cache, Db
from .routers import auth, learning, lumi, profiles

CLIENT_HEADER = "x-lumen-client"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Lumen API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["content-type", CLIENT_HEADER],
    )

    @app.middleware("http")
    async def require_client_header(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Cross-site request forgery defence.

        Browsers will not let another site add a custom header without a preflight that CORS
        refuses, so requiring one on every request that changes something keeps other sites out.
        """
        if request.method not in SAFE_METHODS and CLIENT_HEADER not in request.headers:
            return JSONResponse({"detail": "missing_client_header"}, status_code=403)
        return await call_next(request)

    @app.get("/health", tags=["system"])
    async def health(db: Db, redis: Cache) -> dict[str, str]:
        status = {"api": "ok", "database": "ok", "redis": "ok"}
        try:
            await db.execute(text("select 1"))
        except Exception:
            status["database"] = "down"
        try:
            await redis.ping()
        except Exception:
            status["redis"] = "down"
        return status

    app.include_router(auth.router)
    app.include_router(profiles.router)
    app.include_router(learning.router)
    app.include_router(lumi.router)
    return app


app = create_app()
