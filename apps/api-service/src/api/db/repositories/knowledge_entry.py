"""Knowledge entry repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.knowledge_entry import KnowledgeEntryORM


class KnowledgeEntryRepository:
    """Typed data access for knowledge entries."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_hash(self, content_hash: str) -> KnowledgeEntryORM | None:
        result = await self._session.execute(
            select(KnowledgeEntryORM).where(KnowledgeEntryORM.content_hash == content_hash)
        )
        return result.scalars().first()

    async def save(self, entity: KnowledgeEntryORM) -> KnowledgeEntryORM:
        self._session.add(entity)
        await self._session.flush()
        return entity
