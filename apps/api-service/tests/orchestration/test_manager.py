"""Tests for ManagerAgent classification behavior."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from api.agents.manager_agent import ManagerAgent, ManagerInput, PipelineClassification
from api.lib.pricing import PricingRegistry
from langchain_openai import ChatOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from config.schemas.agents import AgentConfig
from config.schemas.pricing import PricingConfig


def _manager_config() -> AgentConfig:
    return AgentConfig.model_validate(
        {
            "model": "gpt-4o-mini",
            "provider": "openai",
            "temperature": 0.1,
            "max_tokens": 256,
            "max_retries": 1,
            "timeout_seconds": 30,
            "base_url": None,
        }
    )


def _pricing() -> PricingRegistry:
    cfg = PricingConfig.model_validate(
        {
            "models": {
                "openai/gpt-4o-mini": {
                    "input_cost_per_1k": 0.001,
                    "output_cost_per_1k": 0.002,
                }
            }
        }
    )
    return PricingRegistry(cfg)


def _build_agent() -> ManagerAgent:
    return ManagerAgent(
        config=_manager_config(),
        session=AsyncMock(spec=AsyncSession),
        agent_run_repo=AsyncMock(),
        mcp_client=AsyncMock(),
        pricing=_pricing(),
        tracer=MagicMock(),
    )


@pytest.mark.asyncio
async def test_manager_classifies_investigation_intent() -> None:
    agent = _build_agent()
    chain = AsyncMock()
    chain.ainvoke = AsyncMock(
        return_value=PipelineClassification(
            pipeline_type="investigation",
            ticker="AAPL",
            confidence=0.92,
        )
    )
    with patch.object(ChatOpenAI, "with_structured_output", return_value=chain):
        result = await agent.run(ManagerInput(query="analyze AAPL"), uuid4())
    assert result.pipeline_type == "investigation"
    assert result.ticker == "AAPL"


@pytest.mark.asyncio
async def test_manager_classifies_daily_brief_intent() -> None:
    agent = _build_agent()
    chain = AsyncMock()
    chain.ainvoke = AsyncMock(
        return_value=PipelineClassification(
            pipeline_type="daily_brief",
            ticker=None,
            confidence=0.88,
        )
    )
    with patch.object(ChatOpenAI, "with_structured_output", return_value=chain):
        result = await agent.run(ManagerInput(query="send me the morning brief"), uuid4())
    assert result.pipeline_type == "daily_brief"
    assert result.confidence >= 0.5


@pytest.mark.asyncio
async def test_manager_returns_low_confidence_for_unknown() -> None:
    agent = _build_agent()
    chain = AsyncMock()
    chain.ainvoke = AsyncMock(
        return_value=PipelineClassification(
            pipeline_type="unknown",
            ticker=None,
            confidence=0.33,
        )
    )
    with patch.object(ChatOpenAI, "with_structured_output", return_value=chain):
        result = await agent.run(ManagerInput(query="just vibes"), uuid4())
    assert result.pipeline_type == "unknown"
    assert result.confidence < 0.5
