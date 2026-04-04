"""Stub agent used to validate base infrastructure and prompt colocation."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from pydantic import BaseModel

from api.agents.base import BaseAgent


def _load_system_prompt() -> str:
    prompt_path = Path(__file__).with_name("stub_agent.prompt.py")
    spec = importlib.util.spec_from_file_location("api.agents.stub_agent_prompt", prompt_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load stub agent prompt module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    prompt = getattr(module, "STUB_SYSTEM_PROMPT", None)
    if not isinstance(prompt, str):
        raise RuntimeError("STUB_SYSTEM_PROMPT missing or invalid")
    return prompt


class StubInput(BaseModel):
    query: str


class StubOutput(BaseModel):
    answer: str


class StubAgent(BaseAgent[StubInput, StubOutput]):
    """Minimal concrete agent for infrastructure tests."""

    SYSTEM_PROMPT = _load_system_prompt()

    @property
    def name(self) -> str:
        return "stub"

    @property
    def output_schema(self) -> type[StubOutput]:
        return StubOutput

    async def _build_prompt(self, input_data: StubInput) -> str:
        return f"{self.SYSTEM_PROMPT}\n\nUser query:\n{input_data.query}"

