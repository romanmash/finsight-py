"""Watchlist item ORM model."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base, TimestampMixin


class WatchlistItemORM(TimestampMixin, Base):
    """Persisted watchlist symbol with optional per-item thresholds."""

    __tablename__ = "watchlist_items"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    ticker: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(128), nullable=True)
    list_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    price_change_pct_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume_spike_multiplier: Mapped[float | None] = mapped_column(Float, nullable=True)

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
