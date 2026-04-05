"""Seed alerts."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import AlertORM
from api.seeds.constants import (
    ALERT_AAPL_ID,
    ALERT_NVDA_ID,
    ALERT_SPY_ID,
    MISSION_INVESTIGATION_ID,
    WATCHLIST_AAPL_ID,
    WATCHLIST_NVDA_ID,
    WATCHLIST_SPY_ID,
)

_SEED_CREATED_AT = datetime(2026, 4, 1, 8, 45, tzinfo=UTC)
_SEED_UPDATED_AT = datetime(2026, 4, 1, 8, 50, tzinfo=UTC)
_ACKNOWLEDGED_AT = datetime(2026, 4, 1, 8, 55, tzinfo=UTC)


async def seed_alerts(session: AsyncSession) -> None:
    """Seed a mix of acknowledged and unacknowledged alerts."""
    rows = [
        AlertORM(
            id=ALERT_AAPL_ID,
            watchlist_item_id=WATCHLIST_AAPL_ID,
            mission_id=MISSION_INVESTIGATION_ID,
            condition_type="price_move",
            severity="high",
            trigger_condition="price_change_pct >= 3.0",
            observed_value=3.6,
            threshold_value=3.0,
            acknowledged_at=None,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
        AlertORM(
            id=ALERT_NVDA_ID,
            watchlist_item_id=WATCHLIST_NVDA_ID,
            mission_id=None,
            condition_type="volume_spike",
            severity="medium",
            trigger_condition="volume_spike_multiplier >= 2.5",
            observed_value=2.7,
            threshold_value=2.5,
            acknowledged_at=_ACKNOWLEDGED_AT,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
        AlertORM(
            id=ALERT_SPY_ID,
            watchlist_item_id=WATCHLIST_SPY_ID,
            mission_id=None,
            condition_type="price_move",
            severity="low",
            trigger_condition="price_change_pct >= 1.5",
            observed_value=1.6,
            threshold_value=1.5,
            acknowledged_at=_ACKNOWLEDGED_AT,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        ),
    ]
    for row in rows:
        await session.merge(row)
