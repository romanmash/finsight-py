"""Celery worker for scheduled watchdog scans."""

from __future__ import annotations

import asyncio

from api.agents.watchdog_agent import WatchdogAgent
from api.db.repositories.agent_run import AgentRunRepository
from api.db.repositories.alert import AlertRepository
from api.db.repositories.mission import MissionRepository
from api.db.repositories.watchlist_item import WatchlistItemRepository
from api.lib.config import load_all_configs
from api.lib.db import SessionLocal
from api.lib.queues import celery_app
from api.mcp.client import MCPClient


async def _run_watchdog_async() -> None:
    async with SessionLocal() as session:
        configs = load_all_configs()
        agent = WatchdogAgent(
            watchdog_config=configs.watchdog,
            watchlist_repo=WatchlistItemRepository(session),
            alert_repo=AlertRepository(session),
            mission_repo=MissionRepository(session),
            mcp_client=MCPClient(configs.mcp),
            agent_run_repo=AgentRunRepository(session),
        )
        await agent.run()
        await session.commit()


@celery_app.task(name="api.workers.watchdog_worker.run_watchdog_scan", queue="watchdog")  # type: ignore[untyped-decorator]
def run_watchdog_scan() -> None:
    asyncio.run(_run_watchdog_async())
