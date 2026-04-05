"""Seed missions and related agent runs."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import AgentRunORM, MissionORM
from api.seeds.constants import (
    AGENT_RUN_ANALYST_ID,
    AGENT_RUN_REPORTER_ID,
    AGENT_RUN_RESEARCHER_ID,
    MISSION_DAILY_BRIEF_ID,
    MISSION_INVESTIGATION_ID,
    MISSION_SCREENER_ID,
)

_SEED_MISSION_CREATED_AT = datetime(2026, 4, 1, 8, 15, tzinfo=UTC)
_SEED_MISSION_UPDATED_AT = datetime(2026, 4, 1, 8, 35, tzinfo=UTC)
_RUN_STARTED_AT = datetime(2026, 4, 1, 8, 16, tzinfo=UTC)
_RUN_COMPLETED_AT = datetime(2026, 4, 1, 8, 25, tzinfo=UTC)


async def seed_missions(session: AsyncSession) -> None:
    """Seed demo missions and a completed agent pipeline."""
    missions = [
        MissionORM(
            id=MISSION_INVESTIGATION_ID,
            mission_type="investigation",
            source="operator",
            status="completed",
            query="Investigate AAPL post-earnings setup",
            ticker="AAPL",
            created_at=_SEED_MISSION_CREATED_AT,
            updated_at=_SEED_MISSION_UPDATED_AT,
        ),
        MissionORM(
            id=MISSION_DAILY_BRIEF_ID,
            mission_type="daily_brief",
            source="scheduler",
            status="completed",
            query="Generate pre-market brief",
            ticker=None,
            created_at=_SEED_MISSION_CREATED_AT,
            updated_at=_SEED_MISSION_UPDATED_AT,
        ),
        MissionORM(
            id=MISSION_SCREENER_ID,
            mission_type="screener_scan",
            source="scheduler",
            status="failed",
            query="Run morning screener",
            ticker=None,
            created_at=_SEED_MISSION_CREATED_AT,
            updated_at=_SEED_MISSION_UPDATED_AT,
        ),
    ]
    for mission in missions:
        await session.merge(mission)

    agent_runs = [
        AgentRunORM(
            id=AGENT_RUN_RESEARCHER_ID,
            mission_id=MISSION_INVESTIGATION_ID,
            agent_name="researcher",
            status="completed",
            tokens_in=1321,
            tokens_out=824,
            cost_usd=Decimal("0.01324000"),
            provider="openai",
            model="gpt-5-mini",
            duration_ms=3921,
            input_snapshot={"query": "AAPL earnings"},
            output_snapshot={"sources": 7},
            error_message=None,
            started_at=_RUN_STARTED_AT,
            completed_at=_RUN_COMPLETED_AT,
        ),
        AgentRunORM(
            id=AGENT_RUN_ANALYST_ID,
            mission_id=MISSION_INVESTIGATION_ID,
            agent_name="analyst",
            status="completed",
            tokens_in=1095,
            tokens_out=677,
            cost_usd=Decimal("0.01110000"),
            provider="openai",
            model="gpt-5-mini",
            duration_ms=3108,
            input_snapshot={"thesis": "earnings momentum"},
            output_snapshot={"risk_score": 0.42},
            error_message=None,
            started_at=_RUN_STARTED_AT,
            completed_at=_RUN_COMPLETED_AT,
        ),
        AgentRunORM(
            id=AGENT_RUN_REPORTER_ID,
            mission_id=MISSION_INVESTIGATION_ID,
            agent_name="reporter",
            status="completed",
            tokens_in=622,
            tokens_out=436,
            cost_usd=Decimal("0.00628000"),
            provider="openai",
            model="gpt-5-mini",
            duration_ms=1794,
            input_snapshot={"channel": "telegram"},
            output_snapshot={"message_length": 480},
            error_message=None,
            started_at=_RUN_STARTED_AT,
            completed_at=_RUN_COMPLETED_AT,
        ),
    ]
    for run in agent_runs:
        await session.merge(run)
