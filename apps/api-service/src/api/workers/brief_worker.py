"""Celery worker for scheduled daily brief missions."""

from __future__ import annotations

import asyncio

from api.db.repositories.mission import MissionRepository
from api.lib.db import SessionLocal
from api.lib.queues import celery_app
from api.workers.mission_worker import run_mission_pipeline


async def _run_brief_async() -> None:
    async with SessionLocal() as session:
        mission_repo = MissionRepository(session)
        mission = await mission_repo.create(
            {
                "mission_type": "daily_brief",
                "source": "schedule",
                "status": "pending",
                "query": "Generate daily market brief",
                "ticker": None,
            }
        )
        await session.commit()
        run_mission_pipeline.delay(str(mission.id))


@celery_app.task(name="api.workers.brief_worker.run_daily_brief", queue="brief")  # type: ignore[untyped-decorator]
def run_daily_brief() -> None:
    asyncio.run(_run_brief_async())
