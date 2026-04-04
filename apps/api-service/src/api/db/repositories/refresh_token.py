"""Refresh token repository."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.refresh_token import RefreshTokenORM


class RefreshTokenRepository:
    """Typed data access for refresh token entities."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, data: Mapping[str, object]) -> RefreshTokenORM:
        operator_id = data.get("operator_id")
        token_hash = data.get("token_hash")
        expires_at = data.get("expires_at")
        revoked_at = data.get("revoked_at")
        if not isinstance(operator_id, UUID):
            raise TypeError("operator_id must be UUID")
        if not isinstance(token_hash, str):
            raise TypeError("token_hash must be str")
        if not isinstance(expires_at, datetime):
            raise TypeError("expires_at must be datetime")

        entity = RefreshTokenORM(
            operator_id=operator_id,
            token_hash=token_hash,
            expires_at=expires_at,
            revoked_at=revoked_at if isinstance(revoked_at, datetime) else None,
        )
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def get_by_hash(self, token_hash: str) -> RefreshTokenORM | None:
        result = await self._session.execute(
            select(RefreshTokenORM).where(RefreshTokenORM.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def revoke(self, token_id: UUID) -> None:
        result = await self._session.execute(
            select(RefreshTokenORM).where(RefreshTokenORM.id == token_id)
        )
        entity = result.scalar_one_or_none()
        if entity is not None:
            entity.revoked_at = datetime.now(UTC)
            await self._session.flush()
