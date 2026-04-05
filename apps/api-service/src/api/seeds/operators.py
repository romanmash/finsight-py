"""Seed operators."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import OperatorORM
from api.seeds.constants import ADMIN_OPERATOR_ID, VIEWER_OPERATOR_ID

_SEED_CREATED_AT = datetime(2026, 4, 1, 8, 0, tzinfo=UTC)
_SEED_UPDATED_AT = datetime(2026, 4, 1, 8, 5, tzinfo=UTC)


async def _upsert_operator(
    session: AsyncSession,
    *,
    operator_id: UUID,
    email: str,
    role: str,
    plain_password: str,
    telegram_user_id: int | None,
    telegram_chat_id: int | None,
) -> None:
    existing = await session.get(OperatorORM, operator_id)
    password_hash = (
        existing.password_hash if existing is not None else _hash_password(plain_password)
    )
    await session.merge(
        OperatorORM(
            id=operator_id,
            email=email,
            password_hash=password_hash,
            role=role,
            is_active=True,
            telegram_user_id=telegram_user_id,
            telegram_chat_id=telegram_chat_id,
            created_at=_SEED_CREATED_AT,
            updated_at=_SEED_UPDATED_AT,
        )
    )


def _hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def seed_operators(session: AsyncSession) -> None:
    """Seed demo operators with stable primary keys."""
    await _upsert_operator(
        session,
        operator_id=ADMIN_OPERATOR_ID,
        email="admin@finsight.local",
        role="admin",
        plain_password="admin-demo-password",
        telegram_user_id=123456789,
        telegram_chat_id=123456789,
    )
    await _upsert_operator(
        session,
        operator_id=VIEWER_OPERATOR_ID,
        email="viewer@finsight.local",
        role="viewer",
        plain_password="viewer-demo-password",
        telegram_user_id=None,
        telegram_chat_id=None,
    )
