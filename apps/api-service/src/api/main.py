"""FastAPI application entrypoint."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import Response

from api.lib.config import get_settings, load_all_configs
from api.lib.logging import configure_logging
from api.routes.alerts import router as alerts_router
from api.routes.auth import limiter
from api.routes.auth import router as auth_router
from api.routes.dashboard import router as dashboard_router
from api.routes.health import router as health_router
from api.routes.knowledge import router as knowledge_router
from api.routes.missions import router as missions_router
from api.routes.operators import router as operators_router
from api.routes.watchlist import router as watchlist_router

configs = load_all_configs()


def _handle_rate_limit(request: Request, exc: Exception) -> Response:
    if not isinstance(exc, RateLimitExceeded):
        raise exc
    return _rate_limit_exceeded_handler(request, exc)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    loaded = load_all_configs()
    settings = get_settings()
    configure_logging(settings.log_level)
    app.state.configs = loaded
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=configs.api.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In tests, limiter storage is memory:// (see api.routes.auth limiter initialization).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _handle_rate_limit)
app.add_middleware(SlowAPIMiddleware)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(health_router, tags=["health"])
app.include_router(operators_router, prefix="/operators", tags=["operators"])
app.include_router(missions_router, prefix="/missions", tags=["missions"])
app.include_router(watchlist_router, prefix="/watchlist", tags=["watchlist"])
app.include_router(alerts_router, prefix="/alerts", tags=["alerts"])
app.include_router(knowledge_router, prefix="/knowledge", tags=["knowledge"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
