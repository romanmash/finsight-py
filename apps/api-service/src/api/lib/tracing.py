"""LangSmith tracing wrapper with fail-open behaviour."""

from __future__ import annotations

import importlib
import os
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import structlog

logger = structlog.get_logger(__name__)


class TracingClient:
    """Minimal tracing interface used by BaseAgent."""

    def __init__(self) -> None:
        self.enabled = os.getenv("LANGCHAIN_TRACING_V2", "").lower() == "true"
        self._client: Any | None = None
        if self.enabled:
            try:
                module = importlib.import_module("langsmith")
                client_cls = getattr(module, "Client", None)
                if client_cls is None:
                    logger.warning("langsmith_client_missing")
                    return
                self._client = client_cls()
            except Exception as exc:  # pragma: no cover - external SDK failure
                logger.warning("langsmith_client_init_failed", detail=str(exc))
                self._client = None

    def create_run(self, name: str, inputs: Any) -> str | None:
        if not self.enabled or self._client is None:
            return None
        try:
            run_id = str(uuid4())
            self._client.create_run(
                id=run_id,
                name=name,
                run_type="chain",
                inputs={"input": inputs},
                start_time=datetime.now(UTC),
            )
            return run_id
        except Exception as exc:  # pragma: no cover - external SDK failure
            logger.warning("langsmith_create_run_failed", name=name, detail=str(exc))
            return None

    def end_run(self, run_id: str | None, outputs: Any = None, error: str | None = None) -> None:
        if run_id is None or not self.enabled or self._client is None:
            return
        try:
            self._client.update_run(
                run_id=run_id,
                outputs={"output": outputs},
                error=error,
                end_time=datetime.now(UTC),
            )
        except Exception as exc:  # pragma: no cover - external SDK failure
            logger.warning("langsmith_end_run_failed", run_id=run_id, detail=str(exc))
