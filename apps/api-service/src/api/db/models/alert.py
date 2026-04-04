"""Alert ORM model."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base, TimestampMixin


class AlertORM(TimestampMixin, Base):
    """Persisted threshold breach alert."""

    __tablename__ = "alerts"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    watchlist_item_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("watchlist_items.id", ondelete="CASCADE"), index=True, nullable=False
    )
    mission_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("missions.id", ondelete="SET NULL"), index=True, nullable=True
    )
    condition_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    trigger_condition: Mapped[str] = mapped_column(String(512), nullable=False)
    observed_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
