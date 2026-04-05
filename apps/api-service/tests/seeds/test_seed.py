"""Seed idempotency tests."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from api.db.base import Base
from api.db.models import (
    AgentRunORM,
    AlertORM,
    KnowledgeEntryORM,
    MissionORM,
    OperatorORM,
    WatchlistItemORM,
)
from api.seeds.seed import seed
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

_ADMIN_TEST_PASSWORD = "admin-test-password"
_VIEWER_TEST_PASSWORD = "viewer-test-password"


@pytest.fixture(autouse=True)
def _seed_password_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SEED_ADMIN_PASSWORD", _ADMIN_TEST_PASSWORD)
    monkeypatch.setenv("SEED_VIEWER_PASSWORD", _VIEWER_TEST_PASSWORD)


@pytest.fixture()
async def seed_session() -> AsyncIterator[AsyncSession]:
    engine: AsyncEngine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


async def _count(session: AsyncSession, model: type[Base]) -> int:
    result = await session.execute(select(func.count()).select_from(model))
    count = result.scalar_one()
    return int(count)


@pytest.mark.asyncio()
async def test_seed_first_run_inserts_expected_counts(seed_session: AsyncSession) -> None:
    await seed(seed_session)
    await seed_session.commit()

    assert await _count(seed_session, OperatorORM) == 2
    assert await _count(seed_session, WatchlistItemORM) == 5
    assert await _count(seed_session, MissionORM) == 3
    assert await _count(seed_session, AgentRunORM) == 3
    assert await _count(seed_session, KnowledgeEntryORM) == 3
    assert await _count(seed_session, AlertORM) == 3


@pytest.mark.asyncio()
async def test_seed_second_run_is_idempotent(seed_session: AsyncSession) -> None:
    await seed(seed_session)
    await seed_session.commit()
    first_counts = {
        "operators": await _count(seed_session, OperatorORM),
        "watchlist": await _count(seed_session, WatchlistItemORM),
        "missions": await _count(seed_session, MissionORM),
        "agent_runs": await _count(seed_session, AgentRunORM),
        "knowledge_entries": await _count(seed_session, KnowledgeEntryORM),
        "alerts": await _count(seed_session, AlertORM),
    }

    await seed(seed_session)
    await seed_session.commit()
    second_counts = {
        "operators": await _count(seed_session, OperatorORM),
        "watchlist": await _count(seed_session, WatchlistItemORM),
        "missions": await _count(seed_session, MissionORM),
        "agent_runs": await _count(seed_session, AgentRunORM),
        "knowledge_entries": await _count(seed_session, KnowledgeEntryORM),
        "alerts": await _count(seed_session, AlertORM),
    }

    assert second_counts == first_counts


@pytest.mark.asyncio()
async def test_seed_operator_password_uses_bcrypt_prefix(seed_session: AsyncSession) -> None:
    await seed(seed_session)
    await seed_session.commit()

    result = await seed_session.execute(
        select(OperatorORM).where(OperatorORM.email == "admin@finsight.local")
    )
    admin = result.scalar_one()
    assert admin.password_hash.startswith("$2b$")


@pytest.mark.asyncio()
async def test_seed_knowledge_entries_have_null_embeddings(seed_session: AsyncSession) -> None:
    await seed(seed_session)
    await seed_session.commit()

    result = await seed_session.execute(select(KnowledgeEntryORM.embedding))
    embeddings = [value for value in result.scalars().all()]
    assert embeddings == [None, None, None]
