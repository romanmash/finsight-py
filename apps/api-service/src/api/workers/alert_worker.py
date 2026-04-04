"""Celery worker that converts new alerts into investigation missions."""

from __future__ import annotations

import asyncio
import re
from uuid import UUID

from api.db.repositories.alert import AlertRepository
from api.db.repositories.mission import MissionRepository
from api.db.repositories.watchlist_item import WatchlistItemRepository
from api.lib.db import SessionLocal
from api.lib.queues import celery_app
from api.workers.mission_worker import run_mission_pipeline


def _extract_alert_ticker(trigger_condition: str) -> str | None:
    first_token = trigger_condition.split(maxsplit=1)[0].strip(",:;.")
    normalized = first_token[1:] if first_token.startswith("$") else first_token
    if re.fullmatch(r"[A-Z]{1,5}", normalized):
        return normalized
    return None


async def _poll_alerts_async() -> None:
    async with SessionLocal() as session:
        alert_repo = AlertRepository(session)
        mission_repo = MissionRepository(session)
        watchlist_repo = WatchlistItemRepository(session)
        mission_ids: list[UUID] = []
        alerts = await alert_repo.list_unprocessed()
        for alert in alerts:
            watchlist_item = await watchlist_repo.get_by_id(alert.watchlist_item_id)
            ticker = (
                watchlist_item.ticker
                if watchlist_item is not None
                else _extract_alert_ticker(alert.trigger_condition)
            )
            mission = await mission_repo.create(
                {
                    "mission_type": "investigation",
                    "source": "alert",
                    "status": "pending",
                    "query": alert.trigger_condition,
                    "ticker": ticker,
                }
            )
            await alert_repo.set_mission_id(alert.id, mission.id)
            mission_ids.append(mission.id)
        await session.commit()
        for mission_id in mission_ids:
            run_mission_pipeline.delay(str(mission_id))


@celery_app.task(name="api.workers.alert_worker.run_alert_poll", queue="alert")  # type: ignore[untyped-decorator]
def run_alert_poll() -> None:
    asyncio.run(_poll_alerts_async())
