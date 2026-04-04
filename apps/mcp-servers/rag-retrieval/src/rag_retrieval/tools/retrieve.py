"""Knowledge retrieval tool."""

from __future__ import annotations

import json
import os
import time
from datetime import date
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from rag_retrieval.cache import CacheHelper
from rag_retrieval.models import KnowledgeResult, ToolResponse
from rag_retrieval.settings import tool_ttl

_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_cache = CacheHelper(_redis)
_engine = create_async_engine(
    os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./.cache/tests/rag.db")
)
_session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


def _to_list(value: str | None) -> list[str]:
    if value is None:
        return []
    try:
        decoded = json.loads(value)
        return [str(item) for item in decoded] if isinstance(decoded, list) else []
    except json.JSONDecodeError:
        return []


async def get_knowledge_entry(entry_id: str) -> ToolResponse[KnowledgeResult]:
    started = time.perf_counter()
    params = {"entry_id": entry_id}
    key = _cache.make_key("rag-retrieval", "get_knowledge_entry", params)
    cached = await _cache.get(key)
    if cached is not None:
        data = KnowledgeResult.model_validate(cached)
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=data, cache_hit=True, latency_ms=latency)

    stmt = """
        SELECT id, content, source_type, author_agent, confidence, tickers, tags, freshness_date
        FROM knowledge_entries
        WHERE id = :entry_id AND deleted_at IS NULL
    """
    try:
        async with _session_factory() as session:
            result = await session.execute(text(stmt), {"entry_id": entry_id})
            row = result.mappings().first()
    except Exception as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(
            data=None, error=f"get_knowledge_entry failed: {exc}", latency_ms=latency
        )

    if row is None:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error="Not found", latency_ms=latency)

    freshness_raw = row.get("freshness_date")
    freshness_date = (
        date.fromisoformat(str(freshness_raw))
        if freshness_raw is not None and not isinstance(freshness_raw, date)
        else freshness_raw
    )
    raw_content = row.get("content")
    raw_author = row.get("author_agent")
    data = KnowledgeResult(
        id=UUID(str(row["id"])),
        content="" if raw_content is None else str(raw_content),
        source_type=str(row["source_type"]) if row.get("source_type") is not None else None,
        author_agent="unknown" if raw_author is None else str(raw_author),
        confidence=float(row.get("confidence", 0.0)),
        tickers=_to_list(row.get("tickers")),
        tags=_to_list(row.get("tags")),
        freshness_date=freshness_date,
        similarity_score=None,
    )
    await _cache.set(key, data.model_dump(mode="json"), ttl=tool_ttl("get_knowledge_entry"))
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=data, cache_hit=False, latency_ms=latency)
