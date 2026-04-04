"""Tests for rag-retrieval MCP tools."""

from __future__ import annotations

import json
from datetime import datetime
from uuid import uuid4

import fakeredis.aioredis
import pytest
import respx
from rag_retrieval.cache import CacheHelper
from rag_retrieval.server import startup_health_check
from rag_retrieval.tools.retrieve import get_knowledge_entry
from rag_retrieval.tools.search import search_knowledge
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

INSERT_KNOWLEDGE_ENTRY_SQL = text(
    """
    INSERT INTO knowledge_entries (
        id,
        content,
        source_type,
        author_agent,
        confidence,
        tickers,
        tags,
        freshness_date,
        created_at,
        deleted_at
    )
    VALUES (
        :id,
        :content,
        :source_type,
        :author_agent,
        :confidence,
        :tickers,
        :tags,
        :freshness_date,
        :created_at,
        :deleted_at
    )
    """
)


@pytest.fixture(autouse=True)
def fake_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = fakeredis.aioredis.FakeRedis(decode_responses=False)
    cache = CacheHelper(fake)
    monkeypatch.setattr("rag_retrieval.tools.search._cache", cache)
    monkeypatch.setattr("rag_retrieval.tools.retrieve._cache", cache)
    monkeypatch.setattr("rag_retrieval.server._redis", fake)


@pytest.fixture()
async def sqlite_setup(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_async_engine("sqlite+aiosqlite:///./.cache/tests/rag-retrieval.db")
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS knowledge_entries"))
        await conn.execute(
            text(
                """
                CREATE TABLE knowledge_entries (
                    id TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    source_type TEXT NULL,
                    author_agent TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    tickers TEXT NULL,
                    tags TEXT NULL,
                    freshness_date TEXT NULL,
                    created_at TEXT NOT NULL,
                    deleted_at TEXT NULL
                )
                """
            )
        )
    monkeypatch.setattr("rag_retrieval.tools.search._session_factory", session_factory)
    monkeypatch.setattr("rag_retrieval.tools.retrieve._session_factory", session_factory)
    monkeypatch.setattr("rag_retrieval.server._session_factory", session_factory)
    yield
    await engine.dispose()


@pytest.mark.asyncio
async def test_search_knowledge_returns_results(sqlite_setup: None) -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.post("https://api.openai.com/v1/embeddings").respond(
            200, json={"data": [{"embedding": [0.1, 0.2, 0.3]}]}
        )
        from rag_retrieval.tools.search import _session_factory

        async with _session_factory() as session:
            await session.execute(
                INSERT_KNOWLEDGE_ENTRY_SQL,
                {
                    "id": str(uuid4()),
                    "content": "Apple analysis",
                    "source_type": "brief",
                    "author_agent": "analyst",
                    "confidence": 0.9,
                    "tickers": json.dumps(["AAPL"]),
                    "tags": json.dumps(["tech"]),
                    "freshness_date": "2026-01-02",
                    "created_at": datetime.utcnow().isoformat(),
                    "deleted_at": None,
                },
            )
            await session.commit()
        result = await search_knowledge("Apple", limit=10)
        assert result.data is not None
        assert len(result.data) >= 1


@pytest.mark.asyncio
async def test_search_knowledge_empty_db(sqlite_setup: None) -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.post("https://api.openai.com/v1/embeddings").respond(
            200, json={"data": [{"embedding": [0.1, 0.2]}]}
        )
        result = await search_knowledge("none")
        assert result.data == []


@pytest.mark.asyncio
async def test_search_knowledge_with_ticker_filter(sqlite_setup: None) -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.post("https://api.openai.com/v1/embeddings").respond(
            200, json={"data": [{"embedding": [0.1, 0.2]}]}
        )
        from rag_retrieval.tools.search import _session_factory

        async with _session_factory() as session:
            await session.execute(
                INSERT_KNOWLEDGE_ENTRY_SQL,
                [
                    {
                        "id": str(uuid4()),
                        "content": "AAPL note",
                        "source_type": "note",
                        "author_agent": "analyst",
                        "confidence": 0.8,
                        "tickers": json.dumps(["AAPL"]),
                        "tags": json.dumps(["x"]),
                        "freshness_date": None,
                        "created_at": datetime.utcnow().isoformat(),
                        "deleted_at": None,
                    },
                    {
                        "id": str(uuid4()),
                        "content": "MSFT note",
                        "source_type": "note",
                        "author_agent": "analyst",
                        "confidence": 0.8,
                        "tickers": json.dumps(["MSFT"]),
                        "tags": json.dumps(["x"]),
                        "freshness_date": None,
                        "created_at": datetime.utcnow().isoformat(),
                        "deleted_at": None,
                    },
                ],
            )
            await session.commit()
        result = await search_knowledge("tech", tickers=["AAPL"])
        assert result.data is not None
        assert all("AAPL" in row.tickers for row in result.data)


@pytest.mark.asyncio
async def test_search_knowledge_cache_hit(sqlite_setup: None) -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.post("https://api.openai.com/v1/embeddings").respond(
            200, json={"data": [{"embedding": [0.1, 0.2]}]}
        )
        first = await search_knowledge("cache")
        second = await search_knowledge("cache")
        assert first.cache_hit is False
        assert second.cache_hit is True


@pytest.mark.asyncio
async def test_get_knowledge_entry_found(sqlite_setup: None) -> None:
    from rag_retrieval.tools.retrieve import _session_factory

    entry_id = str(uuid4())
    async with _session_factory() as session:
        await session.execute(
            INSERT_KNOWLEDGE_ENTRY_SQL,
            {
                "id": entry_id,
                "content": "Entry",
                "source_type": "note",
                "author_agent": "bookkeeper",
                "confidence": 0.9,
                "tickers": json.dumps(["AAPL"]),
                "tags": json.dumps(["tag"]),
                "freshness_date": None,
                "created_at": datetime.utcnow().isoformat(),
                "deleted_at": None,
            },
        )
        await session.commit()
    result = await get_knowledge_entry(entry_id)
    assert result.data is not None
    assert str(result.data.id) == entry_id


@pytest.mark.asyncio
async def test_get_knowledge_entry_not_found(sqlite_setup: None) -> None:
    result = await get_knowledge_entry(str(uuid4()))
    assert result.data is None
    assert result.error == "Not found"


@pytest.mark.asyncio
async def test_startup_health_check_redis_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    class BadRedis:
        async def ping(self) -> bool:
            raise ConnectionError("down")

    monkeypatch.setattr("rag_retrieval.server._redis", BadRedis())
    with pytest.raises(SystemExit):
        await startup_health_check()


@pytest.mark.asyncio
async def test_startup_health_check_all_ok(sqlite_setup: None) -> None:
    await startup_health_check()



