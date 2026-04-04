"""Knowledge entry ORM model."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, Float, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base, TimestampMixin


class KnowledgeEntryORM(TimestampMixin, Base):
    """Persisted curated knowledge entry."""

    __tablename__ = "knowledge_entries"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    ticker: Mapped[str | None] = mapped_column(String(16), index=True, nullable=True)
    entry_type: Mapped[str | None] = mapped_column(String(32), index=True, nullable=True)
    content_summary: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(
        String(64),
        unique=True,
        nullable=True,
        index=True,
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    freshness_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    content: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    source_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    author_agent: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        default="bookkeeper",
    )
    tickers: Mapped[list[str] | None] = mapped_column(JSON, nullable=True, default=list)
    freshness_date: Mapped[date | None] = mapped_column(nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provenance_history: Mapped[list[dict[str, object]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    conflict_markers: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    embedding: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)
