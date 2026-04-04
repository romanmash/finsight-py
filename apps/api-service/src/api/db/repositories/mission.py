"""Mission repository."""

from __future__ import annotations

from collections.abc import Mapping

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

