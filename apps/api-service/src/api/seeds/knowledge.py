"""Seed knowledge entries."""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import KnowledgeEntryORM
from api.seeds.constants import KB_ENTRY_AAPL_ID, KB_ENTRY_MARKET_ID, KB_ENTRY_NVDA_ID

_SEED_CREATED_AT = datetime(2026, 4, 1, 8, 40, tzinfo=UTC)
_SEED_UPDATED_AT = datetime(2026, 4, 1, 8, 42, tzinfo=UTC)
_SEED_FRESHNESS = datetime(2026, 4, 1, 7, 55, tzinfo=UTC)


async def seed_knowledge(session: AsyncSession) -> None:
    """Seed curated knowledge entries used by dashboard and RAG views."""
    rows = [
        KnowledgeEntryORM(
            id=KB_ENTRY_AAPL_ID,
            ticker="AAPL",
            entry_type="earnings",
            content_summary="AAPL beat EPS estimates and guided stable services growth.",
            content_hash="seed-kb-aapl-011",
            confidence=0.85,
            freshness_at=_SEED_FRESHNESS,
            content="Q4 earnings quality improved, but hardware demand remains mixed.",
            source_type="analysis",
            author_agent="bookkeeper",
            tickers=["AAPL"],
            freshness_date=date(2026, 4, 1),
            provenance_history=[{"source": "seed", "version": "011"}],
            conflict_markers=[],
            tags=["earnings", "quality"],
            embedding=None,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
        KnowledgeEntryORM(
            id=KB_ENTRY_NVDA_ID,
            ticker="NVDA",
            entry_type="sector",
            content_summary="NVDA demand outlook remains strong from hyperscaler capex.",
            content_hash="seed-kb-nvda-011",
            confidence=0.85,
            freshness_at=_SEED_FRESHNESS,
            content="AI datacenter demand still supports premium valuation despite volatility.",
            source_type="analysis",
            author_agent="bookkeeper",
            tickers=["NVDA"],
            freshness_date=date(2026, 4, 1),
            provenance_history=[{"source": "seed", "version": "011"}],
            conflict_markers=["Contradicts prior Q3 assessment"],
            tags=["ai", "semiconductors"],
            embedding=None,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
        KnowledgeEntryORM(
            id=KB_ENTRY_MARKET_ID,
            ticker=None,
            entry_type="macro",
            content_summary="Macro backdrop remains rate-sensitive with mixed growth signals.",
            content_hash="seed-kb-market-011",
            confidence=0.85,
            freshness_at=_SEED_FRESHNESS,
            content="Inflation path is uneven; positioning should remain risk-aware.",
            source_type="macro",
            author_agent="bookkeeper",
            tickers=["SPY", "QQQ"],
            freshness_date=date(2026, 4, 1),
            provenance_history=[{"source": "seed", "version": "011"}],
            conflict_markers=[],
            tags=["macro", "risk"],
            embedding=None,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
    ]
    for row in rows:
        await session.merge(row)
