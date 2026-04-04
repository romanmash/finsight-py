"""Agents runtime schema."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator


class AgentConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    model: str
    provider: str
    temperature: float
    max_tokens: int
    max_retries: int
    timeout_seconds: int
    base_url: str | None = None

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, value: float) -> float:
        if value < 0.0 or value > 2.0:
            raise ValueError("temperature must be between 0.0 and 2.0")
        return value


class AgentsConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    agents: dict[str, AgentConfig]
