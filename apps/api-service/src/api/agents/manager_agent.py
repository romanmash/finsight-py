"""Manager intent-classification agent."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from runpy import run_path
from typing import Literal, cast

from pydantic import BaseModel, Field

from api.agents.base import BaseAgent

_PROMPT_GLOBALS = run_path(str(Path(__file__).with_name("manager_agent.prompt.py")))
MANAGER_SYSTEM_PROMPT = cast(str, _PROMPT_GLOBALS["MANAGER_SYSTEM_PROMPT"])
build_manager_prompt = cast(Callable[[str], str], _PROMPT_GLOBALS["build_manager_prompt"])


class ManagerInput(BaseModel):
    query: str = Field(min_length=1)


class PipelineClassification(BaseModel):
    pipeline_type: Literal["investigation", "daily_brief", "screener_scan", "unknown"]
    ticker: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)


class ManagerAgent(BaseAgent[ManagerInput, PipelineClassification]):
    """Classify mission intent and route target pipeline."""

    @property
    def name(self) -> str:
        return "manager"

    @property
    def output_schema(self) -> type[PipelineClassification]:
        return PipelineClassification

    async def _build_prompt(self, input_data: ManagerInput) -> str:
        return f"{MANAGER_SYSTEM_PROMPT}\n\n{build_manager_prompt(input_data.query)}"
