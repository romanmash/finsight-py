"""Operator repository."""

from __future__ import annotations

from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.operator import OperatorORM


class OperatorRepository:
    """Typed data access for operator entities."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> OperatorORM | None:
        result = await self._session.execute(select(OperatorORM).where(OperatorORM.email == email))
        return result.scalar_one_or_none()

    async def get_by_id(self, operator_id: UUID) -> OperatorORM | None:
        result = await self._session.execute(
            select(OperatorORM).where(OperatorORM.id == operator_id)
        )
        return result.scalar_one_or_none()

    async def get_by_telegram_user_id(self, user_id: int) -> OperatorORM | None:
        result = await self._session.execute(
            select(OperatorORM).where(OperatorORM.telegram_user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def update(
        self,
        operator_id: UUID,
        data: Mapping[str, int | str | None],
    ) -> OperatorORM | None:
        operator = await self.get_by_id(operator_id)
        if operator is None:
            return None

        if "telegram_chat_id" in data:
            value = data["telegram_chat_id"]
            operator.telegram_chat_id = value if isinstance(value, int) else None

        await self._session.flush()
        return operator
