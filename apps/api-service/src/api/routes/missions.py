"""Mission orchestration API routes."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.repositories.agent_run import AgentRunRepository
from api.db.repositories.mission import MissionRepository
from api.lib.auth import TokenPayload, require_role
from api.lib.db import get_session
from api.workers.mission_worker import run_mission_pipeline

router = APIRouter()
_service_or_admin = require_role("admin", "service")
_service_or_viewer_admin = require_role("admin", "viewer", "service")
_viewer_or_admin = require_role("admin", "viewer")
ServiceOrAdminOperator = Annotated[TokenPayload, Depends(_service_or_admin)]
ServiceOrViewerOrAdminOperator = Annotated[TokenPayload, Depends(_service_or_viewer_admin)]
ViewerOrAdminOperator = Annotated[TokenPayload, Depends(_viewer_or_admin)]


class CreateMissionPayload(BaseModel):
    query: str = Field(min_length=1)
    ticker: str | None = None


class MissionResponse(BaseModel):
    mission_id: UUID
    mission_type: str
    source: str
    status: str
    query: str
    ticker: str | None
    created_at: datetime
    updated_at: datetime


class AgentRunResponse(BaseModel):
    agent_name: str
    status: str
    output_data: dict[str, object] | None
    tokens_in: int
    tokens_out: int
    cost_usd: Decimal
    provider: str | None
    model: str | None
    duration_ms: int | None
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None


def _serialize_mission(mission: Any) -> MissionResponse:
    return MissionResponse(
        mission_id=mission.id,
        mission_type=mission.mission_type,
        source=mission.source,
        status=mission.status,
        query=mission.query,
        ticker=mission.ticker,
        created_at=mission.created_at,
        updated_at=mission.updated_at,
    )


def _serialize_agent_run(run: Any) -> AgentRunResponse:
    return AgentRunResponse(
        agent_name=run.agent_name,
        status=run.status,
        output_data=run.output_snapshot,
        tokens_in=run.tokens_in,
        tokens_out=run.tokens_out,
        cost_usd=run.cost_usd,
        provider=run.provider,
        model=run.model,
        duration_ms=run.duration_ms,
        error_message=run.error_message,
        started_at=run.started_at,
        completed_at=run.completed_at,
    )


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_mission(
    payload: CreateMissionPayload,
    _: ServiceOrViewerOrAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    mission_repo = MissionRepository(session)
    mission = await mission_repo.create(
        {
            "mission_type": "unknown",
            "source": "operator",
            "status": "pending",
            "query": payload.query,
            "ticker": payload.ticker,
        }
    )
    await session.commit()
    run_mission_pipeline.delay(str(mission.id))
    return {"mission_id": str(mission.id)}


@router.get("/{mission_id}")
async def get_mission(
    mission_id: UUID,
    _: ViewerOrAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, object]:
    mission_repo = MissionRepository(session)
    agent_run_repo = AgentRunRepository(session)
    mission = await mission_repo.get_by_id(mission_id)
    if mission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")
    runs = await agent_run_repo.list_by_mission(mission_id)
    return {
        "mission": _serialize_mission(mission).model_dump(mode="json"),
        "agent_runs": [_serialize_agent_run(run).model_dump(mode="json") for run in runs],
    }


@router.get("")
async def list_missions(
    _: ViewerOrAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict[str, object]:
    mission_repo = MissionRepository(session)
    missions = await mission_repo.list(status=status_filter, limit=limit, offset=offset)
    return {
        "items": [entry.model_dump(mode="json") for entry in map(_serialize_mission, missions)],
        "limit": limit,
        "offset": offset,
    }


@router.get("/service/recent")
async def list_recent_missions_for_service(
    _: ServiceOrAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=20)] = 10,
) -> dict[str, object]:
    mission_repo = MissionRepository(session)
    missions = await mission_repo.list(source="operator", limit=limit, offset=0)
    return {
        "items": [entry.model_dump(mode="json") for entry in map(_serialize_mission, missions)],
        "limit": limit,
        "offset": 0,
    }
