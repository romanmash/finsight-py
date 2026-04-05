"""Knowledge entry repository."""

from __future__ import annotations

from sqlalchemy import String, cast, or_, select
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

    async def search(
        self,
        *,
        query: str | None,
        limit: int,
        offset: int,
    ) -> list[KnowledgeEntryORM]:
        stmt = select(KnowledgeEntryORM).where(KnowledgeEntryORM.deleted_at.is_(None))
        if isinstance(query, str) and query.strip():
            like = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    cast(KnowledgeEntryORM.ticker, String).ilike(like),
                    cast(KnowledgeEntryORM.content, String).ilike(like),
                    cast(KnowledgeEntryORM.content_summary, String).ilike(like),
                )
            )
        stmt = stmt.order_by(KnowledgeEntryORM.updated_at.desc()).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def save(self, entity: KnowledgeEntryORM) -> KnowledgeEntryORM:
        self._session.add(entity)
        await self._session.flush()
        return entity
