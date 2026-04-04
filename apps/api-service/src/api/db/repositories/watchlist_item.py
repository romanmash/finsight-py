"""Watchlist item repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.watchlist_item import WatchlistItemORM


class WatchlistItemRepository:
    """Typed data access for watchlist items."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_active(self) -> list[WatchlistItemORM]:
        result = await self._session.execute(
            select(WatchlistItemORM).where(
                WatchlistItemORM.is_active.is_(True),
                WatchlistItemORM.deleted_at.is_(None),
            )
        )
        return list(result.scalars().all())

