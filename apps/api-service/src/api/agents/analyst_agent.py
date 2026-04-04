"""Analyst reasoning agent."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from runpy import run_path
from typing import cast

from finsight.shared.models import Assessment, ResearchPacket

from api.agents.base import BaseAgent

_PROMPT_GLOBALS = run_path(str(Path(__file__).with_name("analyst_agent.prompt.py")))
ANALYST_SYSTEM_PROMPT = cast(str, _PROMPT_GLOBALS["ANALYST_SYSTEM_PROMPT"])
build_user_prompt = cast(Callable[[ResearchPacket], str], _PROMPT_GLOBALS["build_user_prompt"])


class AnalystAgent(BaseAgent[ResearchPacket, Assessment]):
    """Reason over one ResearchPacket and return a typed assessment."""

    @property
    def name(self) -> str:
        return "analyst"

    @property
    def output_schema(self) -> type[Assessment]:
        return Assessment

    async def _build_prompt(self, input_data: ResearchPacket) -> str:
        return f"{ANALYST_SYSTEM_PROMPT}\n\n{build_user_prompt(input_data)}"
