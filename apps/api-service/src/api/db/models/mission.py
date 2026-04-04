"""Mission ORM model."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base, TimestampMixin


class MissionORM(TimestampMixin, Base):
    """Persisted mission unit for orchestration."""

    __tablename__ = "missions"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    mission_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    query: Mapped[str] = mapped_column(String(1024), nullable=False)
    ticker: Mapped[str | None] = mapped_column(String(16), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

