"""Operator ORM model."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import Boolean, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base, TimestampMixin


class OperatorORM(TimestampMixin, Base):
    """Persisted operator account used for auth and RBAC."""

    __tablename__ = "operators"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    telegram_user_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    telegram_chat_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
