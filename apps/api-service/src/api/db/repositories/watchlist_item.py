"""Watchlist item repository."""

from __future__ import annotations

import builtins
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.watchlist_item import WatchlistItemORM

_ALLOWED_LIST_TYPES = {"core", "satellite", "experimental"}


class WatchlistItemRepository:
    """Typed data access for watchlist items."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self, *, include_inactive: bool = True) -> builtins.list[WatchlistItemORM]:
        stmt = select(WatchlistItemORM).where(WatchlistItemORM.deleted_at.is_(None))
        if not include_inactive:
            stmt = stmt.where(WatchlistItemORM.is_active.is_(True))
        stmt = stmt.order_by(WatchlistItemORM.ticker.asc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_active(self) -> builtins.list[WatchlistItemORM]:
        result = await self._session.execute(
            select(WatchlistItemORM).where(
                WatchlistItemORM.is_active.is_(True),
                WatchlistItemORM.deleted_at.is_(None),
            )
        )
        return list(result.scalars().all())

    async def create(self, data: dict[str, object]) -> WatchlistItemORM:
        ticker_obj = data.get("ticker")
        name_obj = data.get("name")
        sector_obj = data.get("sector")
        list_type_obj = data.get("list_type")
        is_active_obj = data.get("is_active", True)
        price_change_obj = data.get("price_change_pct_threshold")
        volume_spike_obj = data.get("volume_spike_multiplier")

        if not isinstance(ticker_obj, str) or not ticker_obj.strip():
            raise TypeError("ticker must be non-empty str")
        if name_obj is not None and not isinstance(name_obj, str):
            raise TypeError("name must be str | None")
        if sector_obj is not None and not isinstance(sector_obj, str):
            raise TypeError("sector must be str | None")
        if list_type_obj is not None and not isinstance(list_type_obj, str):
            raise TypeError("list_type must be str | None")
        if isinstance(list_type_obj, str) and list_type_obj.strip() not in _ALLOWED_LIST_TYPES:
            raise ValueError("list_type must be one of core, satellite, experimental")
        if not isinstance(is_active_obj, bool):
            raise TypeError("is_active must be bool")
        if price_change_obj is not None and not isinstance(price_change_obj, (int, float)):
            raise TypeError("price_change_pct_threshold must be float | None")
        if volume_spike_obj is not None and not isinstance(volume_spike_obj, (int, float)):
            raise TypeError("volume_spike_multiplier must be float | None")

        entity = WatchlistItemORM(
            ticker=ticker_obj.strip().upper(),
            name=name_obj.strip() if isinstance(name_obj, str) and name_obj.strip() else None,
            sector=(
                sector_obj.strip() if isinstance(sector_obj, str) and sector_obj.strip() else None
            ),
            list_type=(
                list_type_obj.strip()
                if isinstance(list_type_obj, str) and list_type_obj.strip()
                else None
            ),
            is_active=is_active_obj,
            price_change_pct_threshold=(
                float(price_change_obj) if isinstance(price_change_obj, (int, float)) else None
            ),
            volume_spike_multiplier=(
                float(volume_spike_obj) if isinstance(volume_spike_obj, (int, float)) else None
            ),
        )
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def get_by_id(self, watchlist_item_id: UUID) -> WatchlistItemORM | None:
        result = await self._session.execute(
            select(WatchlistItemORM).where(
                WatchlistItemORM.id == watchlist_item_id,
                WatchlistItemORM.deleted_at.is_(None),
            )
        )
        return result.scalars().first()

    async def update(
        self,
        watchlist_item_id: UUID,
        data: dict[str, object],
    ) -> WatchlistItemORM | None:
        entity = await self.get_by_id(watchlist_item_id)
        if entity is None:
            return None

        if "ticker" in data:
            ticker_obj = data["ticker"]
            if not isinstance(ticker_obj, str) or not ticker_obj.strip():
                raise TypeError("ticker must be non-empty str")
            entity.ticker = ticker_obj.strip().upper()

        if "is_active" in data:
            active_obj = data["is_active"]
            if not isinstance(active_obj, bool):
                raise TypeError("is_active must be bool")
            entity.is_active = active_obj

        if "name" in data:
            value = data["name"]
            if value is not None and not isinstance(value, str):
                raise TypeError("name must be str | None")
            entity.name = value.strip() if isinstance(value, str) and value.strip() else None

        if "sector" in data:
            value = data["sector"]
            if value is not None and not isinstance(value, str):
                raise TypeError("sector must be str | None")
            entity.sector = value.strip() if isinstance(value, str) and value.strip() else None

        if "list_type" in data:
            value = data["list_type"]
            if value is not None and not isinstance(value, str):
                raise TypeError("list_type must be str | None")
            if isinstance(value, str) and value.strip() not in _ALLOWED_LIST_TYPES:
                raise ValueError("list_type must be one of core, satellite, experimental")
            entity.list_type = value.strip() if isinstance(value, str) and value.strip() else None

        if "price_change_pct_threshold" in data:
            value = data["price_change_pct_threshold"]
            if value is not None and not isinstance(value, (int, float)):
                raise TypeError("price_change_pct_threshold must be float | None")
            entity.price_change_pct_threshold = (
                float(value) if isinstance(value, (int, float)) else None
            )

        if "volume_spike_multiplier" in data:
            value = data["volume_spike_multiplier"]
            if value is not None and not isinstance(value, (int, float)):
                raise TypeError("volume_spike_multiplier must be float | None")
            entity.volume_spike_multiplier = (
                float(value) if isinstance(value, (int, float)) else None
            )

        await self._session.flush()
        return entity

    async def soft_delete(self, watchlist_item_id: UUID) -> bool:
        entity = await self.get_by_id(watchlist_item_id)
        if entity is None:
            return False
        entity.deleted_at = datetime.now(UTC)
        await self._session.flush()
        return True
