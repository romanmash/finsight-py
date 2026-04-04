"""Async database engine and session management."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.ext.asyncio import (
    create_async_engine as sa_create_async_engine,
)

from api.lib.config import get_settings


def create_async_engine() -> AsyncEngine:
    """Create the shared async SQLAlchemy engine from settings."""
    settings = get_settings()
    database_url = settings.database_url
    if not database_url:
        raise RuntimeError("DATABASE_URL is missing")

    try:
        return sa_create_async_engine(database_url, pool_pre_ping=True, future=True)
    except Exception as exc:
        raise RuntimeError(f"Failed to create async engine from DATABASE_URL: {exc}") from exc


engine = create_async_engine()
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession]:
    """Yield a transactional async DB session."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
