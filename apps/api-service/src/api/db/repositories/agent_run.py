"""AgentRun repository."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.agent_run import AgentRunORM


class AgentRunRepository:
    """Typed data access for agent run entities."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, data: Mapping[str, object]) -> AgentRunORM:
        mission_id = data.get("mission_id")
        agent_name = data.get("agent_name")
        status = data.get("status")
        tokens_in = data.get("tokens_in", 0)
        tokens_out = data.get("tokens_out", 0)
        cost_usd = data.get("cost_usd", Decimal("0.00"))
        provider = data.get("provider")
        model = data.get("model")
        duration_ms = data.get("duration_ms")
        input_snapshot = data.get("input_snapshot")
        output_snapshot = data.get("output_snapshot")
        error_message = data.get("error_message")
        started_at = data.get("started_at")
        completed_at = data.get("completed_at")

        if not isinstance(mission_id, UUID):
            raise TypeError("mission_id must be UUID")
        if not isinstance(agent_name, str):
            raise TypeError("agent_name must be str")
        if not isinstance(status, str):
            raise TypeError("status must be str")
        if not isinstance(tokens_in, int):
            raise TypeError("tokens_in must be int")
        if not isinstance(tokens_out, int):
            raise TypeError("tokens_out must be int")
        if not isinstance(cost_usd, Decimal):
            raise TypeError("cost_usd must be Decimal")
        if provider is not None and not isinstance(provider, str):
            raise TypeError("provider must be str | None")
        if model is not None and not isinstance(model, str):
            raise TypeError("model must be str | None")
        if duration_ms is not None and not isinstance(duration_ms, int):
            raise TypeError("duration_ms must be int | None")
        if input_snapshot is not None and not isinstance(input_snapshot, dict):
            raise TypeError("input_snapshot must be dict | None")
        if output_snapshot is not None and not isinstance(output_snapshot, dict):
            raise TypeError("output_snapshot must be dict | None")
        if error_message is not None and not isinstance(error_message, str):
            raise TypeError("error_message must be str | None")
        if not isinstance(started_at, datetime):
            raise TypeError("started_at must be datetime")
        if completed_at is not None and not isinstance(completed_at, datetime):
            raise TypeError("completed_at must be datetime | None")

        entity = AgentRunORM(
            mission_id=mission_id,
            agent_name=agent_name,
            status=status,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_usd=cost_usd,
            provider=provider,
            model=model,
            duration_ms=duration_ms,
            input_snapshot=input_snapshot,
            output_snapshot=output_snapshot,
            error_message=error_message,
            started_at=started_at,
            completed_at=completed_at,
        )
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def list_by_mission(self, mission_id: UUID) -> list[AgentRunORM]:
        result = await self._session.execute(
            select(AgentRunORM)
            .where(AgentRunORM.mission_id == mission_id)
            .order_by(AgentRunORM.started_at.asc())
        )
        return list(result.scalars().all())

