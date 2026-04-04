"""Knowledge search tool."""

from __future__ import annotations

import json
import math
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
from rag_retrieval.settings import tool_ttl

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


def _to_embedding(value: object) -> list[float]:
    if value is None:
        return []
    if isinstance(value, list):
        return [float(item) for item in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        if isinstance(parsed, list):
            return [float(item) for item in parsed]
    return []


def _cosine_similarity(a: list[float], b: list[float]) -> float | None:
    if not a or not b or len(a) != len(b):
        return None
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return None
    return dot / (norm_a * norm_b)


def _pgvector_param(embedding: list[float]) -> str:
    values = ",".join(str(component) for component in embedding)
    return f"[{values}]"


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
        query_embedding = await _embed(query)
    except httpx.HTTPError as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"Embedding failed: {exc}", latency_ms=latency)
    try:
        async with _session_factory() as session:
            dialect_name = session.bind.dialect.name if session.bind is not None else ""
            if dialect_name == "postgresql":
                stmt = """
                    SELECT
                        id,
                        content,
                        source_type,
                        author_agent,
                        confidence,
                        tickers,
                        tags,
                        freshness_date,
                        (embedding <=> CAST(:embedding AS vector)) AS distance
                    FROM knowledge_entries
                    WHERE deleted_at IS NULL AND embedding IS NOT NULL
                    ORDER BY embedding <=> CAST(:embedding AS vector)
                """
                result = await session.execute(
                    text(stmt),
                    {"embedding": _pgvector_param(query_embedding)},
                )
                rows = result.mappings().all()
            else:
                stmt = """
                    SELECT
                        id,
                        content,
                        source_type,
                        author_agent,
                        confidence,
                        tickers,
                        tags,
                        freshness_date,
                        embedding
                    FROM knowledge_entries
                    WHERE deleted_at IS NULL
                """
                result = await session.execute(text(stmt))
                rows = result.mappings().all()
    except Exception as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"search_knowledge failed: {exc}", latency_ms=latency)

    results: list[KnowledgeResult] = []
    for row in rows:
        raw_content = row.get("content")
        raw_author = row.get("author_agent")
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
        distance = row.get("distance")
        similarity_score: float | None
        if distance is not None:
            similarity_score = max(0.0, 1.0 - float(distance))
        else:
            similarity_score = _cosine_similarity(
                query_embedding,
                _to_embedding(row.get("embedding")),
            )
        results.append(
            KnowledgeResult(
                id=UUID(str(row["id"])),
                content="" if raw_content is None else str(raw_content),
                source_type=str(row["source_type"]) if row.get("source_type") is not None else None,
                author_agent="unknown" if raw_author is None else str(raw_author),
                confidence=float(row.get("confidence", 0.0)),
                tickers=row_tickers,
                tags=row_tags,
                freshness_date=freshness_date,
                similarity_score=similarity_score,
            )
        )

    results.sort(key=lambda item: item.similarity_score or -1.0, reverse=True)
    results = results[:limit]
    await _cache.set(
        key,
        {"items": [item.model_dump(mode="json") for item in results]},
        ttl=tool_ttl("search_knowledge"),
    )
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=results, cache_hit=False, latency_ms=latency)
