"""Alert repository."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.alert import AlertORM
from api.db.models.watchlist_item import WatchlistItemORM


class AlertRepository:
    """Typed data access for alert entities."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, data: Mapping[str, object]) -> AlertORM:
        watchlist_item_id = data.get("watchlist_item_id")
        mission_id = data.get("mission_id")
        condition_type = data.get("condition_type")
        severity = data.get("severity")
        trigger_condition = data.get("trigger_condition")
        observed_value = data.get("observed_value")
        threshold_value = data.get("threshold_value")

        from uuid import UUID

        if not isinstance(watchlist_item_id, UUID):
            raise TypeError("watchlist_item_id must be UUID")
        if mission_id is not None and not isinstance(mission_id, UUID):
            raise TypeError("mission_id must be UUID | None")
        if not isinstance(condition_type, str):
            raise TypeError("condition_type must be str")
        if not isinstance(severity, str):
            raise TypeError("severity must be str")
        if not isinstance(trigger_condition, str):
            raise TypeError("trigger_condition must be str")
        if observed_value is not None and not isinstance(observed_value, (int, float)):
            raise TypeError("observed_value must be float | None")
        if threshold_value is not None and not isinstance(threshold_value, (int, float)):
            raise TypeError("threshold_value must be float | None")

        entity = AlertORM(
            watchlist_item_id=watchlist_item_id,
            mission_id=mission_id,
            condition_type=condition_type,
            severity=severity,
            trigger_condition=trigger_condition,
            observed_value=float(observed_value) if observed_value is not None else None,
            threshold_value=float(threshold_value) if threshold_value is not None else None,
        )
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def get_recent(
        self, ticker: str, condition_type: str, window_hours: int
    ) -> list[AlertORM]:
        cutoff = datetime.now(UTC) - timedelta(hours=window_hours)
        stmt = (
            select(AlertORM)
            .join(WatchlistItemORM, WatchlistItemORM.id == AlertORM.watchlist_item_id)
            .where(
                WatchlistItemORM.ticker == ticker,
                AlertORM.condition_type == condition_type,
                AlertORM.created_at >= cutoff,
                AlertORM.deleted_at.is_(None),
            )
            .order_by(AlertORM.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
