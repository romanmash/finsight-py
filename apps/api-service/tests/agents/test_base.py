"""Tests for BaseAgent infrastructure behaviour."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from api.agents.base import AgentOutputError, BaseAgent
from api.agents.shared.prompts import SYSTEM_ROLE_PREAMBLE
from api.agents.stub_agent import StubAgent
from api.lib.tracing import TracingClient
from api.mcp.client import MCPToolError
from pydantic import BaseModel, ValidationError

from config.schemas.agents import AgentConfig


class AgentTestInput(BaseModel):
    query: str


class AgentTestOutput(BaseModel):
    answer: str
    usage_metadata: dict[str, int] | None = None


class DemoAgent(BaseAgent[AgentTestInput, AgentTestOutput]):
    @property
    def name(self) -> str:
        return "test-agent"

    @property
    def output_schema(self) -> type[AgentTestOutput]:
        return AgentTestOutput

    async def _build_prompt(self, input_data: AgentTestInput) -> str:
        return f"prompt:{input_data.query}"


def _validation_error() -> ValidationError:
    return ValidationError.from_exception_data(
        "TestOutput",
        [{"type": "missing", "loc": ("answer",), "input": {}}],
    )


def _build_config(*, model: str = "gpt-4o-mini", provider: str = "openai") -> AgentConfig:
    return AgentConfig(
        model=model,
        provider=provider,
        temperature=0.0,
        max_tokens=1024,
        max_retries=1,
        timeout_seconds=10,
        base_url=None,
        fallback_model="gpt-4o-mini",
        fallback_provider="openai",
    )


@pytest.mark.asyncio
async def test_run_creates_agent_run_record(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    tracer = MagicMock(spec=TracingClient)
    tracer.create_run.return_value = "run-1"
    tracer.end_run.return_value = None
    agent = DemoAgent(
        config=_build_config(),
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=tracer,
    )

    chain = AsyncMock()
    chain.ainvoke = AsyncMock(
        return_value=AgentTestOutput(
            answer="done",
            usage_metadata={"input_tokens": 1000, "output_tokens": 500},
        )
    )
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    result = await agent.run(AgentTestInput(query="status"), uuid4())

    assert result.answer == "done"
    assert mock_agent_run_repo.create.await_count == 1
    payload = mock_agent_run_repo.create.await_args.args[0]
    assert payload["status"] == "completed"
    assert payload["tokens_in"] == 1000
    assert payload["tokens_out"] == 500
    assert payload["provider"] == "openai"
    assert payload["model"] == "gpt-4o-mini"
    assert payload["duration_ms"] >= 0
    assert payload["cost_usd"] == Decimal("0.002")


@pytest.mark.asyncio
async def test_run_cost_matches_pricing_registry(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    tracer = MagicMock(spec=TracingClient)
    agent = DemoAgent(
        config=_build_config(),
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=tracer,
    )
    chain = AsyncMock()
    chain.ainvoke = AsyncMock(
        return_value=AgentTestOutput(
            answer="ok",
            usage_metadata={"input_tokens": 1000, "output_tokens": 500},
        )
    )
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    await agent.run(AgentTestInput(query="q"), uuid4())
    payload = mock_agent_run_repo.create.await_args.args[0]
    assert payload["cost_usd"] == Decimal("0.002")


@pytest.mark.asyncio
async def test_run_with_langsmith_tracing(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    tracer = MagicMock(spec=TracingClient)
    tracer.create_run.return_value = "trace-id"
    tracer.end_run.return_value = None
    agent = DemoAgent(
        config=_build_config(),
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=tracer,
    )
    chain = AsyncMock()
    chain.ainvoke = AsyncMock(return_value=AgentTestOutput(answer="ok"))
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    await agent.run(AgentTestInput(query="q"), uuid4())

    tracer.create_run.assert_called_once()
    tracer.end_run.assert_called_once()


@pytest.mark.asyncio
async def test_run_unknown_model_cost_is_zero(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    tracer = MagicMock(spec=TracingClient)
    agent = DemoAgent(
        config=_build_config(model="unknown-model"),
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=tracer,
    )
    chain = AsyncMock()
    chain.ainvoke = AsyncMock(
        return_value=AgentTestOutput(
            answer="ok",
            usage_metadata={"input_tokens": 1, "output_tokens": 1},
        )
    )
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    await agent.run(AgentTestInput(query="q"), uuid4())
    payload = mock_agent_run_repo.create.await_args.args[0]
    assert payload["cost_usd"] == Decimal("0.00")


@pytest.mark.asyncio
async def test_call_tool_success(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    agent = DemoAgent(
        config=_build_config(),
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )
    result = await agent._call_tool("market.get_price", {"symbol": "AAPL"})
    assert result == {"ok": True, "price": 123.45}


@pytest.mark.asyncio
async def test_call_tool_mcp_error_returns_none(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    mock_mcp_client.call_tool = AsyncMock(side_effect=MCPToolError("market.get_price", "failed"))
    agent = DemoAgent(
        config=_build_config(),
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )
    result = await agent._call_tool("market.get_price", {"symbol": "AAPL"})
    assert result is None


@pytest.mark.asyncio
async def test_call_tool_timeout_returns_none(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    mock_mcp_client.call_tool = AsyncMock(side_effect=MCPToolError("market.get_price", "timeout"))
    agent = DemoAgent(
        config=_build_config(),
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )
    result = await agent._call_tool("market.get_price", {"symbol": "AAPL"})
    assert result is None


@pytest.mark.asyncio
async def test_valid_output_accepted_no_retry(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    agent = DemoAgent(
        config=_build_config(),
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )
    chain = AsyncMock()
    chain.ainvoke = AsyncMock(return_value=AgentTestOutput(answer="ok"))
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    await agent.run(AgentTestInput(query="q"), uuid4())

    assert chain.ainvoke.call_count == 1
    payload = mock_agent_run_repo.create.await_args.args[0]
    assert payload["status"] == "completed"


@pytest.mark.asyncio
async def test_invalid_output_triggers_one_retry(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    agent = DemoAgent(
        config=_build_config(),
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )
    chain = AsyncMock()
    chain.ainvoke = AsyncMock(side_effect=[_validation_error(), AgentTestOutput(answer="ok")])
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    await agent.run(AgentTestInput(query="q"), uuid4())

    assert chain.ainvoke.call_count == 2
    payload = mock_agent_run_repo.create.await_args.args[0]
    assert payload["status"] == "completed"


@pytest.mark.asyncio
async def test_two_invalid_outputs_marks_failed(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    agent = DemoAgent(
        config=_build_config(),
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )
    chain = AsyncMock()
    chain.ainvoke = AsyncMock(side_effect=[_validation_error(), _validation_error()])
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    with pytest.raises(AgentOutputError):
        await agent.run(AgentTestInput(query="q"), uuid4())

    assert chain.ainvoke.call_count == 2
    assert mock_agent_run_repo.create.await_count == 1
    payload = mock_agent_run_repo.create.await_args.args[0]
    assert payload["status"] == "failed"
    assert payload["error_message"] is not None


@pytest.mark.asyncio
async def test_primary_provider_failure_uses_fallback(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
) -> None:
    config = _build_config(model="claude-sonnet-4-20250514", provider="anthropic")
    config = config.model_copy(
        update={"fallback_provider": "openai", "fallback_model": "gpt-4o-mini"}
    )
    agent = DemoAgent(
        config=config,
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )
    primary = AsyncMock()
    primary.ainvoke = AsyncMock(side_effect=Exception("provider unavailable"))
    fallback = AsyncMock()
    fallback.ainvoke = AsyncMock(
        return_value=AgentTestOutput(
            answer="fallback",
            usage_metadata={"input_tokens": 10, "output_tokens": 20},
        )
    )

    def _fake_build_chain(provider: str, model: str, base_url: str | None) -> AsyncMock:
        if provider == "anthropic":
            return primary
        return fallback

    agent._build_chain = MagicMock(side_effect=_fake_build_chain)  # type: ignore[method-assign]

    output = await agent.run(AgentTestInput(query="q"), uuid4())

    assert output.answer == "fallback"
    payload = mock_agent_run_repo.create.await_args.args[0]
    assert payload["provider"] == "openai"
    assert payload["model"] == "gpt-4o-mini"


def test_prompt_file_colocated_with_agent() -> None:
    assert Path("apps/api-service/src/api/agents/stub_agent.prompt.py").exists()


def test_shared_prompt_fragments_importable() -> None:
    assert isinstance(SYSTEM_ROLE_PREAMBLE, str)
    assert len(SYSTEM_ROLE_PREAMBLE) > 0


def test_stub_agent_uses_shared_prompts() -> None:
    assert SYSTEM_ROLE_PREAMBLE in StubAgent.SYSTEM_PROMPT
