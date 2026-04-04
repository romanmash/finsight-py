"""DB-layer pytest fixtures for async repositories."""

from __future__ import annotations

import importlib
import pkgutil
from collections.abc import AsyncIterator

import pytest
from api.db.base import Base
from fakeredis.aioredis import FakeRedis
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def _import_all_orm_models() -> None:
    """Import all modules under api.db.models to register ORM tables on metadata."""
    models_pkg = importlib.import_module("api.db.models")
    package_path = getattr(models_pkg, "__path__", None)
    if package_path is None:
        return
    for module_info in pkgutil.iter_modules(package_path):
        if not module_info.ispkg:
            importlib.import_module(f"api.db.models.{module_info.name}")


@pytest.fixture()
async def async_engine() -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture()
async def session(async_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    _import_all_orm_models()
    async with async_engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=async_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as db_session:
        yield db_session

    async with async_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)


@pytest.fixture()
async def fake_redis() -> AsyncIterator[FakeRedis]:
    redis = FakeRedis()
    try:
        yield redis
    finally:
        await redis.aclose()
