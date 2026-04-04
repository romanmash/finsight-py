"""Tests for Celery queue schedule wiring."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from api.lib import queues


def test_build_periodic_schedule_raises_for_unknown_scheduled_pipeline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    scheduler = SimpleNamespace(
        timezone="Europe/Copenhagen",
        alert_poll_interval_seconds=30,
        pipelines=[
            SimpleNamespace(name="daily_brief", cron="0 7 * * MON-FRI"),
            SimpleNamespace(name="nonexistent_pipeline", cron="*/5 * * * *"),
        ],
    )
    monkeypatch.setattr(
        queues,
        "load_all_configs",
        lambda: SimpleNamespace(scheduler=scheduler),
    )

    with pytest.raises(RuntimeError, match="Unknown scheduled pipeline"):
        queues._build_periodic_schedule()
