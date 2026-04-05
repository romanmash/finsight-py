"""Aggregated dashboard endpoints."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.repositories.agent_run import AgentRunRepository
from api.db.repositories.alert import AlertRepository
from api.db.repositories.mission import MissionRepository
from api.db.repositories.watchlist_item import WatchlistItemRepository
from api.lib.db import get_session
from api.routes.dashboard_auth import DashboardViewerOrAdminOperator
from api.routes.health import health as system_health

router = APIRouter()


@router.get("/overview")
async def dashboard_overview(
    _: DashboardViewerOrAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
    recent_limit: Annotated[int, Query(ge=1, le=50)] = 5,
) -> dict[str, object]:
    mission_repo = MissionRepository(session)
    watchlist_repo = WatchlistItemRepository(session)
    alert_repo = AlertRepository(session)
    agent_run_repo = AgentRunRepository(session)

    active_missions = await mission_repo.list(status="running", limit=100, offset=0)
    pending = await mission_repo.list(status="pending", limit=100, offset=0)
    recent = await mission_repo.list(limit=recent_limit, offset=0)
    watchlist_items = await watchlist_repo.list(include_inactive=True)
    unacknowledged_alerts = await alert_repo.list(unacknowledged_only=True, limit=100)
    recent_agent_runs = await agent_run_repo.list_recent(limit=recent_limit)

    watchlist_active_count = sum(1 for item in watchlist_items if item.is_active)
    watchlist_total_count = len(watchlist_items)

    return {
        "counts": {
            "running": len(active_missions),
            "pending": len(pending),
            "watchlist_total": watchlist_total_count,
            "watchlist_active": watchlist_active_count,
            "unacknowledged_alerts": len(unacknowledged_alerts),
        },
        "active_missions": [
            {
                "id": str(entry.id),
                "status": entry.status,
                "mission_type": entry.mission_type,
                "query": entry.query,
                "ticker": entry.ticker,
                "updated_at": entry.updated_at.isoformat(),
            }
            for entry in active_missions
        ],
        "unacknowledged_alerts": [
            {
                "id": str(alert.id),
                "severity": alert.severity,
                "trigger_condition": alert.trigger_condition,
                "created_at": alert.created_at.isoformat(),
            }
            for alert in unacknowledged_alerts[:5]
        ],
        "recent_missions": [
            {
                "mission_id": str(entry.id),
                "status": entry.status,
                "mission_type": entry.mission_type,
                "query": entry.query,
                "ticker": entry.ticker,
                "updated_at": entry.updated_at.isoformat(),
            }
            for entry in recent
        ],
        "recent_agent_runs": [
            {
                "id": str(run.id),
                "mission_id": str(run.mission_id),
                "agent_name": run.agent_name,
                "status": run.status,
                "duration_ms": run.duration_ms,
                "started_at": run.started_at.isoformat(),
            }
            for run in recent_agent_runs
        ],
    }


@router.get("/health")
async def dashboard_health(_: DashboardViewerOrAdminOperator) -> dict[str, object]:
    base = await system_health()
    subsystems_obj = base.get("subsystems")
    subsystems = subsystems_obj if isinstance(subsystems_obj, Mapping) else {}
    database_status = str(subsystems.get("database", "unknown"))
    cache_status = str(subsystems.get("cache", "unknown"))

    services = {
        "api": str(base.get("status", "unknown")),
        "celery-beat": "unknown",
        "worker-mission": "unknown",
        "worker-alert": "unknown",
        "worker-screener": "unknown",
        "worker-watchdog": "unknown",
        "worker-brief": "unknown",
        "telegram-bot": "unknown",
        "telegram-worker": "unknown",
        "dashboard": "ok",
        "database": database_status,
        "cache": cache_status,
    }
    return {
        "status": str(base.get("status", "unknown")),
        "services": services,
        "subsystems": dict(subsystems),
        "last_updated": datetime.now(UTC).isoformat(),
    }
