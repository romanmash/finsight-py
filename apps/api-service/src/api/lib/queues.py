"""Celery app and beat schedule wiring."""

from __future__ import annotations

import os
from datetime import timedelta
from typing import Any

from celery import Celery  # type: ignore[import-untyped]
from celery.schedules import crontab  # type: ignore[import-untyped]

from api.lib.config import get_settings, load_all_configs


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _build_periodic_schedule() -> dict[str, dict[str, Any]]:
    config = load_all_configs().scheduler
    schedule: dict[str, dict[str, Any]] = {}
    task_map = {
        "daily_brief": ("api.workers.brief_worker.run_daily_brief", "brief"),
        "screener_scan": ("api.workers.screener_worker.run_screener_scan", "screener"),
        "watchdog_scan": ("api.workers.watchdog_worker.run_watchdog_scan", "watchdog"),
    }

    for pipeline in config.pipelines:
        if pipeline.cron is None:
            continue
        mapped = task_map.get(pipeline.name)
        if mapped is None:
            raise RuntimeError(
                f"Unknown scheduled pipeline '{pipeline.name}' in scheduler configuration"
            )
        task_name, queue_name = mapped
        minute, hour, day_of_month, month_of_year, day_of_week = pipeline.cron.split(maxsplit=4)
        schedule[f"{pipeline.name}-schedule"] = {
            "task": task_name,
            "schedule": crontab(
                minute=minute,
                hour=hour,
                day_of_month=day_of_month,
                month_of_year=month_of_year,
                day_of_week=day_of_week,
            ),
            "options": {"queue": queue_name},
        }

    schedule["alert-poll-schedule"] = {
        "task": "api.workers.alert_worker.run_alert_poll",
        "schedule": timedelta(seconds=config.alert_poll_interval_seconds),
        "options": {"queue": "alert"},
    }
    return schedule


settings = get_settings()
celery_app = Celery(
    "finsight",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.update(
    task_always_eager=_env_flag("CELERY_TASK_ALWAYS_EAGER", default=False),
    task_eager_propagates=True,
    timezone=load_all_configs().scheduler.timezone,
    beat_schedule=_build_periodic_schedule(),
)

celery_app.autodiscover_tasks(["api.workers"])
