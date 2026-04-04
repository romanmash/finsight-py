"""Celery worker for scheduled screener scan missions."""

from __future__ import annotations

import asyncio
from uuid import UUID

from api.db.repositories.mission import MissionRepository
from api.db.repositories.watchlist_item import WatchlistItemRepository
from api.lib.db import SessionLocal
from api.lib.queues import celery_app
from api.workers.mission_worker import run_mission_pipeline


async def _run_screener_async() -> None:
    async with SessionLocal() as session:
        mission_repo = MissionRepository(session)
        watchlist_repo = WatchlistItemRepository(session)
        mission_ids: list[UUID] = []
        items = await watchlist_repo.list_active()
        for item in items:
            mission = await mission_repo.create(
                {
                    "mission_type": "screener_scan",
                    "source": "schedule",
                    "status": "pending",
                    "query": f"Run screener scan for {item.ticker}",
                    "ticker": item.ticker,
                }
            )
            mission_ids.append(mission.id)
        await session.commit()
        for mission_id in mission_ids:
            run_mission_pipeline.delay(str(mission_id))


@celery_app.task(name="api.workers.screener_worker.run_screener_scan", queue="screener")  # type: ignore[untyped-decorator]
def run_screener_scan() -> None:
    asyncio.run(_run_screener_async())
