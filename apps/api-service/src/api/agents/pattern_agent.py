"""Technician (pattern specialist) agent."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from runpy import run_path
from typing import cast
from uuid import UUID

from finsight.shared.models import OHLCVBar, PatternReport, PatternType
from pydantic import BaseModel, Field

from api.agents.base import BaseAgent

_PROMPT_GLOBALS = run_path(str(Path(__file__).with_name("pattern_agent.prompt.py")))
PATTERN_SYSTEM_PROMPT = cast(str, _PROMPT_GLOBALS["PATTERN_SYSTEM_PROMPT"])
build_user_prompt = cast(
    Callable[[list[OHLCVBar], str], str],
    _PROMPT_GLOBALS["build_user_prompt"],
)


class PatternInput(BaseModel):
    ticker: str
    price_history: list[OHLCVBar] = Field(default_factory=list)
    mission_id: UUID


class PatternAgent(BaseAgent[PatternInput, PatternReport]):
    """Identify technical patterns from OHLCV history."""

    @property
    def name(self) -> str:
        return "technician"

    @property
    def output_schema(self) -> type[PatternReport]:
        return PatternReport

    async def _build_prompt(self, input_data: PatternInput) -> str:
        user_prompt = build_user_prompt(input_data.price_history, input_data.ticker)
        return f"{PATTERN_SYSTEM_PROMPT}\n\n{user_prompt}"

    async def run(self, input_data: PatternInput, mission_id: UUID) -> PatternReport:
        if len(input_data.price_history) >= 5:
            return await super().run(input_data, mission_id)

        started_at = datetime.now(UTC)
        run_id = self.tracer.create_run(self.name, self._to_snapshot(input_data))
        result = PatternReport(
            pattern_type=PatternType.NO_PATTERN,
            pattern_name=None,
            confidence=0.0,
            observations=[],
            timeframe="insufficient-data",
            no_pattern_rationale="Insufficient price history",
        )
        completed_at = datetime.now(UTC)
        await self.agent_run_repo.create(
            {
                "mission_id": mission_id,
                "agent_name": self.name,
                "status": "completed",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": Decimal("0.00"),
                "provider": self.config.provider,
                "model": self.config.model,
                "duration_ms": self._duration_ms(started_at, completed_at),
                "input_snapshot": self._to_snapshot(input_data),
                "output_snapshot": self._to_snapshot(result),
                "error_message": None,
                "started_at": started_at,
                "completed_at": completed_at,
            }
        )
        self.tracer.end_run(run_id, outputs=self._to_snapshot(result), error=None)
        return result
