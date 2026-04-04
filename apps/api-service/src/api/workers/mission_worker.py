"""Celery worker for end-to-end mission pipeline execution."""

from __future__ import annotations

import asyncio
import os
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from api.agents.analyst_agent import AnalystAgent
from api.agents.bookkeeper_agent import BookkeeperAgent
from api.agents.manager_agent import ManagerAgent
from api.agents.pattern_agent import PatternAgent
from api.agents.reporter_agent import ReporterAgent
from api.agents.researcher_agent import ResearcherAgent
from api.agents.watchdog_agent import WatchdogAgent
from api.db.repositories.agent_run import AgentRunRepository
from api.db.repositories.alert import AlertRepository
from api.db.repositories.mission import MissionRepository
from api.db.repositories.watchlist_item import WatchlistItemRepository
from api.graphs.nodes import OrchestrationAgents
from api.graphs.supervisor import build_supervisor_graph
from api.lib.config import get_settings, load_all_configs
from api.lib.db import SessionLocal
from api.lib.pricing import get_registry
from api.lib.queues import celery_app
from api.lib.tracing import TracingClient
from api.mcp.client import MCPClient


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _build_checkpointer() -> Any:
    if _env_flag("CELERY_TASK_ALWAYS_EAGER", default=False):
        from langgraph.checkpoint.memory import MemorySaver

        return MemorySaver()

    checkpoint_url = os.getenv("LANGGRAPH_CHECKPOINT_DB_URL") or get_settings().database_url

    try:
        from langgraph.checkpoint.postgres import PostgresSaver

        saver = PostgresSaver.from_conn_string(checkpoint_url)
        setup_fn = getattr(saver, "setup", None)
        if callable(setup_fn):
            setup_fn()
        return saver
    except Exception as exc:
        raise RuntimeError(
            "Failed to initialize Postgres LangGraph checkpointer; refusing in-memory fallback"
        ) from exc


def _build_agents(session: AsyncSession) -> tuple[ManagerAgent, OrchestrationAgents]:
    configs = load_all_configs()
    pricing = get_registry(configs)
    tracer = TracingClient()
    mcp_client = MCPClient(configs.mcp)
    agent_run_repo = AgentRunRepository(session)

    manager = ManagerAgent(
        config=configs.agents.agents["manager"],
        session=session,
        agent_run_repo=agent_run_repo,
        mcp_client=mcp_client,
        pricing=pricing,
        tracer=tracer,
    )
    researcher = ResearcherAgent(agent_run_repo, mcp_client, configs.researcher)
    analyst = AnalystAgent(
        config=configs.agents.agents["analyst"],
        session=session,
        agent_run_repo=agent_run_repo,
        mcp_client=mcp_client,
        pricing=pricing,
        tracer=tracer,
    )
    technician = PatternAgent(
        config=configs.agents.agents["technician"],
        session=session,
        agent_run_repo=agent_run_repo,
        mcp_client=mcp_client,
        pricing=pricing,
        tracer=tracer,
    )
    bookkeeper = BookkeeperAgent(
        session=session,
        agent_run_repo=agent_run_repo,
        tracer=tracer,
    )
    reporter = ReporterAgent(
        config=configs.agents.agents["reporter"],
        session=session,
        agent_run_repo=agent_run_repo,
        mcp_client=mcp_client,
        pricing=pricing,
        tracer=tracer,
    )
    watchdog = WatchdogAgent(
        watchdog_config=configs.watchdog,
        watchlist_repo=WatchlistItemRepository(session),
        alert_repo=AlertRepository(session),
        mission_repo=MissionRepository(session),
        mcp_client=mcp_client,
        agent_run_repo=agent_run_repo,
    )
    return manager, OrchestrationAgents(
        researcher=researcher,
        analyst=analyst,
        technician=technician,
        bookkeeper=bookkeeper,
        reporter=reporter,
        watchdog=watchdog,
    )


async def _run_pipeline_async(mission_id: UUID) -> None:
    async with SessionLocal() as session:
        mission_repo = MissionRepository(session)
        mission = await mission_repo.get_by_id(mission_id)
        if mission is None:
            return
        if mission.status == "completed":
            return
        await mission_repo.update_status(mission_id, "running")

        checkpointer = _build_checkpointer()
        manager, agents = _build_agents(session)
        graph = build_supervisor_graph(checkpointer=checkpointer, manager=manager, agents=agents)

        try:
            result = await graph.ainvoke(
                {
                    "mission_id": mission_id,
                    "query": mission.query,
                    "pipeline_type": mission.mission_type,
                    "ticker": mission.ticker,
                    "research_packet": None,
                    "assessment": None,
                    "pattern_report": None,
                    "formatted_report": None,
                    "error": None,
                    "completed_nodes": [],
                },
                config={"configurable": {"thread_id": str(mission_id)}},
            )
            await mission_repo.update_status(mission_id, "completed")
            formatted_report = result.get("formatted_report")
            if formatted_report is not None:
                payload = (
                    formatted_report.model_dump(mode="json")
                    if hasattr(formatted_report, "model_dump")
                    else formatted_report
                )
                celery_app.send_task(
                    "telegram_bot.notifier.deliver_to_telegram",
                    args=[str(mission_id), payload],
                    queue="telegram",
                )
            await session.commit()
        except Exception:
            await mission_repo.update_status(mission_id, "failed")
            await session.commit()
            raise
        finally:
            close_fn = getattr(checkpointer, "close", None)
            if callable(close_fn):
                close_fn()


@celery_app.task(
    bind=True,
    max_retries=1,
    name="api.workers.mission_worker.run_mission_pipeline",
    queue="mission",
)  # type: ignore[untyped-decorator]
def run_mission_pipeline(self: Any, mission_id: str) -> None:
    try:
        asyncio.run(_run_pipeline_async(UUID(mission_id)))
    except Exception as exc:
        raise self.retry(exc=exc) from exc
