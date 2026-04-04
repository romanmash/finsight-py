"""Tests for BookkeeperAgent."""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import date
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from api.agents.bookkeeper_agent import BookkeeperAgent, BookkeeperInput
from api.db.base import Base
from api.db.models.knowledge_entry import KnowledgeEntryORM
from api.lib.tracing import TracingClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest.fixture()
async def sqlite_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture()
def bookkeeper_input() -> BookkeeperInput:
    return BookkeeperInput(
        ticker="AAPL",
        entry_type="analysis",
        content_summary="Revenue growth accelerating with stable margins.",
        source_agent="analyst",
        mission_id=uuid4(),
        confidence=0.8,
        freshness_date=date(2026, 1, 2),
        tickers=["AAPL"],
        tags=["earnings"],
    )


@pytest.mark.asyncio
async def test_bookkeeper_writes_new_entry(
    sqlite_session: AsyncSession,
    mock_agent_run_repo: AsyncMock,
    bookkeeper_input: BookkeeperInput,
) -> None:
    agent = BookkeeperAgent(
        session=sqlite_session,
        agent_run_repo=mock_agent_run_repo,
        tracer=MagicMock(spec=TracingClient),
    )

    result = await agent.run(bookkeeper_input, bookkeeper_input.mission_id)

    rows = (await sqlite_session.execute(select(KnowledgeEntryORM))).scalars().all()
    assert len(rows) == 1
    assert rows[0].ticker == "AAPL"
    assert rows[0].author_agent == "bookkeeper"
    assert rows[0].content == bookkeeper_input.content_summary
    assert rows[0].content_hash
    assert result.ticker == "AAPL"


@pytest.mark.asyncio
async def test_bookkeeper_deduplication_upserts_not_duplicates(
    sqlite_session: AsyncSession,
    mock_agent_run_repo: AsyncMock,
    bookkeeper_input: BookkeeperInput,
) -> None:
    agent = BookkeeperAgent(
        session=sqlite_session,
        agent_run_repo=mock_agent_run_repo,
        tracer=MagicMock(spec=TracingClient),
    )

    first = await agent.run(bookkeeper_input, bookkeeper_input.mission_id)
    second = await agent.run(bookkeeper_input, bookkeeper_input.mission_id)

    rows = (await sqlite_session.execute(select(KnowledgeEntryORM))).scalars().all()
    assert len(rows) == 1
    assert first.content_hash == second.content_hash


@pytest.mark.asyncio
async def test_bookkeeper_conflict_flagged(
    sqlite_session: AsyncSession,
    mock_agent_run_repo: AsyncMock,
    bookkeeper_input: BookkeeperInput,
) -> None:
    agent = BookkeeperAgent(
        session=sqlite_session,
        agent_run_repo=mock_agent_run_repo,
        tracer=MagicMock(spec=TracingClient),
    )

    await agent.run(bookkeeper_input, bookkeeper_input.mission_id)
    incoming = bookkeeper_input.model_copy(
        update={
            "content_summary": (
                "Fraud allegation introduces litigation tail risk and "
                "solvency concerns."
            ),
            "confidence": 0.85,
        }
    )

    result = await agent.run(incoming, incoming.mission_id)

    rows = (await sqlite_session.execute(select(KnowledgeEntryORM))).scalars().all()
    assert len(rows) == 1
    assert len(result.conflict_markers) > 0
    assert "Conflict with entry" in result.conflict_markers[0]
