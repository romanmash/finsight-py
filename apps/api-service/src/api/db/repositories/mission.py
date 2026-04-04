"""Mission repository."""

from __future__ import annotations

from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.mission import MissionORM


class MissionRepository:
    """Typed data access for mission entities."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, data: Mapping[str, object]) -> MissionORM:
        mission_type = data.get("mission_type")
        source = data.get("source")
        status = data.get("status")
        query = data.get("query")
        ticker = data.get("ticker")

        if not isinstance(mission_type, str):
            raise TypeError("mission_type must be str")
        if not isinstance(source, str):
            raise TypeError("source must be str")
        if not isinstance(status, str):
            raise TypeError("status must be str")
        if not isinstance(query, str):
            raise TypeError("query must be str")
        if ticker is not None and not isinstance(ticker, str):
            raise TypeError("ticker must be str | None")

        entity = MissionORM(
            mission_type=mission_type,
            source=source,
            status=status,
            query=query,
            ticker=ticker,
        )
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def get_by_id(self, mission_id: UUID) -> MissionORM | None:
        result = await self._session.execute(
            select(MissionORM).where(
                MissionORM.id == mission_id,
                MissionORM.deleted_at.is_(None),
            )
        )
        return result.scalars().first()

    async def list(
        self,
        *,
        status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[MissionORM]:
        stmt = select(MissionORM).where(MissionORM.deleted_at.is_(None))
        if status is not None:
            stmt = stmt.where(MissionORM.status == status)
        stmt = stmt.order_by(MissionORM.created_at.desc()).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def update_status(self, mission_id: UUID, status: str) -> MissionORM | None:
        mission = await self.get_by_id(mission_id)
        if mission is None:
            return None
        mission.status = status
        await self._session.flush()
        return mission
