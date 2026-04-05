"""Seed watchlist items."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import WatchlistItemORM
from api.seeds.constants import (
    WATCHLIST_AAPL_ID,
    WATCHLIST_MSFT_ID,
    WATCHLIST_NVDA_ID,
    WATCHLIST_QQQ_ID,
    WATCHLIST_SPY_ID,
)

_SEED_CREATED_AT = datetime(2026, 4, 1, 8, 10, tzinfo=UTC)
_SEED_UPDATED_AT = datetime(2026, 4, 1, 8, 12, tzinfo=UTC)


async def seed_watchlist(session: AsyncSession) -> None:
    """Seed a realistic stock and ETF watchlist."""
    rows = [
        WatchlistItemORM(
            id=WATCHLIST_AAPL_ID,
            ticker="AAPL",
            name="Apple Inc.",
            sector="Technology",
            list_type="stock",
            is_active=True,
            price_change_pct_threshold=3.0,
            volume_spike_multiplier=2.2,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
        WatchlistItemORM(
            id=WATCHLIST_NVDA_ID,
            ticker="NVDA",
            name="NVIDIA Corp.",
            sector="Technology",
            list_type="stock",
            is_active=True,
            price_change_pct_threshold=4.0,
            volume_spike_multiplier=2.5,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
        WatchlistItemORM(
            id=WATCHLIST_MSFT_ID,
            ticker="MSFT",
            name="Microsoft Corp.",
            sector="Technology",
            list_type="stock",
            is_active=True,
            price_change_pct_threshold=2.5,
            volume_spike_multiplier=2.0,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
        WatchlistItemORM(
            id=WATCHLIST_SPY_ID,
            ticker="SPY",
            name="SPDR S&P 500 ETF",
            sector="Broad Market",
            list_type="etf",
            is_active=True,
            price_change_pct_threshold=1.5,
            volume_spike_multiplier=1.8,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
        WatchlistItemORM(
            id=WATCHLIST_QQQ_ID,
            ticker="QQQ",
            name="Invesco QQQ Trust",
            sector="Nasdaq 100",
            list_type="etf",
            is_active=True,
            price_change_pct_threshold=2.0,
            volume_spike_multiplier=1.9,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
    ]
    for row in rows:
        await session.merge(row)
