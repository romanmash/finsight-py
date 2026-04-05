"""Alert routes for dashboard consumption."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Protocol
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.repositories.alert import AlertRepository
from api.lib.db import get_session
from api.routes.dashboard_auth import DashboardViewerOrAdminOperator

router = APIRouter()


class AlertResponse(BaseModel):
    id: UUID
    watchlist_item_id: UUID
    mission_id: UUID | None
    condition_type: str
    severity: str
    trigger_condition: str
    observed_value: float | None
    threshold_value: float | None
    acknowledged_at: datetime | None
    created_at: datetime


class _AlertLike(Protocol):
    id: UUID
    watchlist_item_id: UUID
    mission_id: UUID | None
    condition_type: str
    severity: str
    trigger_condition: str
    observed_value: float | None
    threshold_value: float | None
    acknowledged_at: datetime | None
    created_at: datetime


def _serialize(entity: _AlertLike) -> AlertResponse:
    return AlertResponse(
        id=entity.id,
        watchlist_item_id=entity.watchlist_item_id,
        mission_id=entity.mission_id,
        condition_type=entity.condition_type,
        severity=entity.severity,
        trigger_condition=entity.trigger_condition,
        observed_value=entity.observed_value,
        threshold_value=entity.threshold_value,
        acknowledged_at=entity.acknowledged_at,
        created_at=entity.created_at,
    )


@router.get("")
async def list_alerts(
    _: DashboardViewerOrAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
    unacknowledged_only: Annotated[bool, Query(alias="unacknowledged_only")] = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> dict[str, object]:
    repo = AlertRepository(session)
    items = await repo.list(unacknowledged_only=unacknowledged_only, limit=limit)
    return {"items": [_serialize(item).model_dump(mode="json") for item in items]}


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: UUID,
    _: DashboardViewerOrAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    repo = AlertRepository(session)
    entity = await repo.acknowledge(alert_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    await session.commit()
    return {"status": "acknowledged"}
