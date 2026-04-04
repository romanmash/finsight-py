"""AgentRun ORM model."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base


class AgentRunORM(Base):
    """Persisted agent execution record."""

    __tablename__ = "agent_runs"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    mission_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("missions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    agent_name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    tokens_in: Mapped[int] = mapped_column(default=0, nullable=False)
    tokens_out: Mapped[int] = mapped_column(default=0, nullable=False)
    cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 8), default=Decimal("0.00"), nullable=False
    )
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(nullable=True)
    input_snapshot: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    output_snapshot: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
