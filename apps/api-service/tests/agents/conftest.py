"""Shared fixtures for agent infrastructure tests."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from api.lib.config import load_yaml_config
from api.lib.pricing import PricingRegistry
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from config.schemas.agents import AgentsConfig
from config.schemas.pricing import PricingConfig


class DummyOutput(BaseModel):
    answer: str


@pytest.fixture()
def mock_agent_run_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.create = AsyncMock(
        return_value={
            "id": uuid4(),
            "status": "completed",
            "cost_usd": Decimal("0.00"),
        }
    )
    return repo


@pytest.fixture()
def mock_mcp_client() -> AsyncMock:
    client = AsyncMock()
    client.call_tool = AsyncMock(return_value={"ok": True, "price": 123.45})
    return client


@pytest.fixture()
def mock_llm_chain() -> AsyncMock:
    chain = AsyncMock()
    chain.ainvoke = AsyncMock(return_value=DummyOutput(answer="ok"))
    return chain


@pytest.fixture()
def pricing_registry() -> PricingRegistry:
    cfg = PricingConfig.model_validate(
        {
            "models": {
                "openai/gpt-4o-mini": {"input_cost_per_1k": 0.001, "output_cost_per_1k": 0.002},
                "openai/gpt-4o": {"input_cost_per_1k": 0.005, "output_cost_per_1k": 0.010},
            }
        }
    )
    return PricingRegistry(cfg)


@pytest.fixture()
def agent_configs() -> AgentsConfig:
    return load_yaml_config(Path("config/runtime/agents.yaml"), AgentsConfig)


@pytest.fixture()
def session_mock() -> AsyncSession:
    return AsyncMock(spec=AsyncSession)


@pytest.fixture()
def usage_tokens() -> dict[str, int]:
    return {"tokens_in": 1000, "tokens_out": 500}


@pytest.fixture()
def example_tool_payload() -> dict[str, Any]:
    return {"symbol": "AAPL"}

