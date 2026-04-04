"""Knowledge search tool."""

from __future__ import annotations

import json
import os
import time
from datetime import date
from uuid import UUID

import httpx
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from rag_retrieval.cache import CacheHelper
from rag_retrieval.models import KnowledgeResult, ToolResponse

_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_cache = CacheHelper(_redis)
_openai_base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
_openai_key = os.getenv("OPENAI_API_KEY", "")
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


async def _embed(query: str) -> list[float]:
    payload = {"model": "text-embedding-3-small", "input": query}
    headers = {"Authorization": f"Bearer {_openai_key}"} if _openai_key else {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(f"{_openai_base}/embeddings", json=payload, headers=headers)
        response.raise_for_status()
        body = response.json()
    data = body.get("data", []) if isinstance(body, dict) else []
    first = data[0] if data else {}
    embedding = first.get("embedding", []) if isinstance(first, dict) else []
    return [float(x) for x in embedding]


async def search_knowledge(
    query: str,
    limit: int = 10,
    tickers: list[str] | None = None,
    tags: list[str] | None = None,
) -> ToolResponse[list[KnowledgeResult]]:
    started = time.perf_counter()
    params = {"query": query, "limit": limit, "tickers": tickers, "tags": tags}
    key = _cache.make_key("rag-retrieval", "search_knowledge", params)
    cached = await _cache.get(key)
    if cached is not None:
        data = [KnowledgeResult.model_validate(item) for item in cached.get("items", [])]
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=data, cache_hit=True, latency_ms=latency)

    try:
        await _embed(query)
    except httpx.HTTPError as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"Embedding failed: {exc}", latency_ms=latency)

    stmt = """
        SELECT id, content, source_type, author_agent, confidence, tickers, tags, freshness_date
        FROM knowledge_entries
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT :limit
    """
    try:
        async with _session_factory() as session:
            result = await session.execute(text(stmt), {"limit": limit})
            rows = result.mappings().all()
    except Exception as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"search_knowledge failed: {exc}", latency_ms=latency)

    results: list[KnowledgeResult] = []
    for row in rows:
        row_tickers = _to_list(row.get("tickers"))
        row_tags = _to_list(row.get("tags"))
        if tickers and not any(t in row_tickers for t in tickers):
            continue
        if tags and not any(t in row_tags for t in tags):
            continue
        freshness_raw = row.get("freshness_date")
        freshness_date = (
            date.fromisoformat(str(freshness_raw))
            if freshness_raw is not None and not isinstance(freshness_raw, date)
            else freshness_raw
        )
        results.append(
            KnowledgeResult(
                id=UUID(str(row["id"])),
                content=str(row["content"]),
                source_type=str(row["source_type"]) if row.get("source_type") is not None else None,
                author_agent=str(row["author_agent"]),
                confidence=float(row.get("confidence", 0.0)),
                tickers=row_tickers,
                tags=row_tags,
                freshness_date=freshness_date,
                similarity_score=None,
            )
        )

    await _cache.set(key, {"items": [item.model_dump(mode="json") for item in results]}, ttl=60)
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=results, cache_hit=False, latency_ms=latency)
