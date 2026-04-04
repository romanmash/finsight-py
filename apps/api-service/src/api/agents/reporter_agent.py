"""Reporter formatting agent."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from runpy import run_path
from typing import cast
from uuid import UUID

from finsight.shared.models import Assessment, FormattedReport, PatternReport
from pydantic import BaseModel

from api.agents.base import BaseAgent

_PROMPT_GLOBALS = run_path(str(Path(__file__).with_name("reporter_agent.prompt.py")))
REPORTER_SYSTEM_PROMPT = cast(str, _PROMPT_GLOBALS["REPORTER_SYSTEM_PROMPT"])
build_user_prompt = cast(
    Callable[[Assessment, PatternReport, str, UUID], str],
    _PROMPT_GLOBALS["build_user_prompt"],
)


class ReporterInput(BaseModel):
    assessment: Assessment
    pattern_report: PatternReport
    ticker: str
    mission_id: UUID


class ReporterAgent(BaseAgent[ReporterInput, FormattedReport]):
    """Format structured agent outputs for delivery surfaces."""

    @property
    def name(self) -> str:
        return "reporter"

    @property
    def output_schema(self) -> type[FormattedReport]:
        return FormattedReport

    async def _build_prompt(self, input_data: ReporterInput) -> str:
        user_prompt = build_user_prompt(
            input_data.assessment,
            input_data.pattern_report,
            input_data.ticker,
            input_data.mission_id,
        )
        return (
            f"{REPORTER_SYSTEM_PROMPT}\n\n"
            f"{user_prompt}"
        )
