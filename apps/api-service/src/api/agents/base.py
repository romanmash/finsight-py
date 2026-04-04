"""Shared base class for all FinSight agents."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Protocol, TypedDict
from uuid import UUID

import structlog
from langchain_core.language_models.chat_models import BaseChatModel
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from api.lib.pricing import PricingRegistry
from api.lib.tracing import TracingClient
from api.mcp.client import MCPClient, MCPToolError
from config.schemas.agents import AgentConfig

logger = structlog.get_logger(__name__)

class AgentRunPayload(TypedDict):
    mission_id: UUID
    agent_name: str
    status: str
    tokens_in: int
    tokens_out: int
    cost_usd: Decimal
    provider: str | None
    model: str | None
    duration_ms: int
    input_snapshot: dict[str, Any]
    output_snapshot: dict[str, Any] | None
    error_message: str | None
    started_at: datetime
    completed_at: datetime


class AgentRunRepositoryProtocol(Protocol):
    async def create(self, payload: AgentRunPayload) -> Any:
        """Persist one AgentRun record."""


class StructuredOutputChain(Protocol):
    async def ainvoke(self, input: Any, **kwargs: Any) -> Any:
        """Invoke structured output runnable."""


class LLMProviderError(Exception):
    """Raised when provider invocation fails."""


class AgentOutputError(Exception):
    """Raised when agent output cannot be validated after retries."""

    def __init__(self, agent_name: str, detail: str) -> None:
        self.agent_name = agent_name
        self.detail = detail
        super().__init__(f"{agent_name}: {detail}")


class BaseAgent[InputT: BaseModel, OutputT: BaseModel](ABC):
    """Generic base class handling shared agent execution concerns."""

    def __init__(
        self,
        config: AgentConfig,
        session: AsyncSession,
        agent_run_repo: AgentRunRepositoryProtocol,
        mcp_client: MCPClient,
        pricing: PricingRegistry,
        tracer: TracingClient,
    ) -> None:
        self.config = config
        self.session = session
        self.agent_run_repo = agent_run_repo
        self.mcp_client = mcp_client
        self.pricing = pricing
        self.tracer = tracer

    @property
    @abstractmethod
    def name(self) -> str:
        """Stable agent identifier."""

    @property
    @abstractmethod
    def output_schema(self) -> type[OutputT]:
        """Pydantic output schema."""

    @abstractmethod
    async def _build_prompt(self, input_data: InputT) -> str:
        """Build prompt from typed input."""

    async def _call_tool(self, tool_name: str, params: dict[str, Any]) -> dict[str, Any] | None:
        try:
            return await self.mcp_client.call_tool(tool_name, params)
        except MCPToolError as exc:
            logger.error("mcp_tool_error", tool=tool_name, detail=str(exc))
            return None

    async def run(self, input_data: InputT, mission_id: UUID) -> OutputT:
        started_at = datetime.now(UTC)
        run_id = self.tracer.create_run(self.name, self._to_snapshot(input_data))
        prompt = await self._build_prompt(input_data)

        model_used = self.config.model
        provider_used: str | None = self.config.provider
        try:
            primary_chain = self._build_chain(
                provider=self.config.provider,
                model=self.config.model,
                base_url=self.config.base_url,
            )
            result, tokens_in, tokens_out = await self._invoke_llm_with_retry(prompt, primary_chain)
        except LLMProviderError:
            if self.config.fallback_provider and self.config.fallback_model:
                provider_used = self.config.fallback_provider
                model_used = self.config.fallback_model
                try:
                    fallback_chain = self._build_chain(
                        provider=self.config.fallback_provider,
                        model=self.config.fallback_model,
                        base_url=self.config.base_url,
                    )
                    result, tokens_in, tokens_out = await self._invoke_llm_with_retry(
                        prompt, fallback_chain
                    )
                except Exception as fallback_error:
                    await self._record_failed_run(
                        mission_id=mission_id,
                        started_at=started_at,
                        input_data=input_data,
                        detail=str(fallback_error),
                        provider=provider_used,
                        model=model_used,
                    )
                    self.tracer.end_run(run_id, outputs=None, error=str(fallback_error))
                    raise
            else:
                await self._record_failed_run(
                    mission_id=mission_id,
                    started_at=started_at,
                    input_data=input_data,
                    detail="primary_provider_failed_no_fallback",
                    provider=provider_used,
                    model=model_used,
                )
                self.tracer.end_run(
                    run_id,
                    outputs=None,
                    error="primary_provider_failed_no_fallback",
                )
                raise
        except AgentOutputError as exc:
            await self._record_failed_run(
                mission_id=mission_id,
                started_at=started_at,
                input_data=input_data,
                detail=exc.detail,
                provider=provider_used,
                model=model_used,
            )
            self.tracer.end_run(run_id, outputs=None, error=exc.detail)
            raise
        except Exception as exc:
            await self._record_failed_run(
                mission_id=mission_id,
                started_at=started_at,
                input_data=input_data,
                detail=str(exc),
                provider=provider_used,
                model=model_used,
            )
            self.tracer.end_run(run_id, outputs=None, error=str(exc))
            raise

        duration_ms = self._duration_ms(started_at, datetime.now(UTC))
        lookup_name = f"{provider_used}/{model_used}" if provider_used else model_used
        cost_usd = self.pricing.compute_cost(lookup_name, tokens_in, tokens_out)
        output_snapshot = self._to_snapshot(result)
        payload: AgentRunPayload = {
            "mission_id": mission_id,
            "agent_name": self.name,
            "status": "completed",
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "cost_usd": cost_usd,
            "provider": provider_used,
            "model": model_used,
            "duration_ms": duration_ms,
            "input_snapshot": self._to_snapshot(input_data),
            "output_snapshot": output_snapshot,
            "error_message": None,
            "started_at": started_at,
            "completed_at": datetime.now(UTC),
        }
        await self.agent_run_repo.create(payload)
        self.tracer.end_run(run_id, outputs=output_snapshot, error=None)
        return result

    async def _record_failed_run(
        self,
        mission_id: UUID,
        started_at: datetime,
        input_data: InputT,
        detail: str,
        provider: str | None,
        model: str | None,
    ) -> None:
        payload: AgentRunPayload = {
            "mission_id": mission_id,
            "agent_name": self.name,
            "status": "failed",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": Decimal("0.00"),
            "provider": provider,
            "model": model,
            "duration_ms": self._duration_ms(started_at, datetime.now(UTC)),
            "input_snapshot": self._to_snapshot(input_data),
            "output_snapshot": None,
            "error_message": detail,
            "started_at": started_at,
            "completed_at": datetime.now(UTC),
        }
        await self.agent_run_repo.create(payload)

    async def _invoke_llm_with_retry(
        self, prompt: str, chain: StructuredOutputChain
    ) -> tuple[OutputT, int, int]:
        try:
            return await self._invoke_once(prompt, chain)
        except ValidationError as first_error:
            logger.warning(
                "agent_output_validation_retry",
                agent=self.name,
                detail=str(first_error),
            )
            try:
                return await self._invoke_once(prompt, chain)
            except ValidationError as second_error:
                raise AgentOutputError(
                    agent_name=self.name,
                    detail=str(second_error),
                ) from second_error

    async def _invoke_once(
        self, prompt: str, chain: StructuredOutputChain
    ) -> tuple[OutputT, int, int]:
        try:
            raw_result = await chain.ainvoke(prompt)
        except ValidationError:
            raise
        except Exception as exc:
            raise LLMProviderError(str(exc)) from exc
        raw_tokens_in, raw_tokens_out = self._extract_usage_metadata_from_raw(raw_result)
        result = self._coerce_output(raw_result)
        parsed_tokens_in, parsed_tokens_out = self._extract_usage_metadata(result)
        tokens_in = raw_tokens_in if raw_tokens_in > 0 else parsed_tokens_in
        tokens_out = raw_tokens_out if raw_tokens_out > 0 else parsed_tokens_out
        return result, tokens_in, tokens_out

    def _coerce_output(self, raw_result: Any) -> OutputT:
        if isinstance(raw_result, dict) and "parsed" in raw_result:
            candidate = raw_result.get("parsed")
            if isinstance(candidate, self.output_schema):
                return candidate
            return self.output_schema.model_validate(candidate)
        if isinstance(raw_result, self.output_schema):
            return raw_result
        parsed = self.output_schema.model_validate(raw_result)
        return parsed

    def _extract_usage_metadata(self, result: OutputT) -> tuple[int, int]:
        usage = getattr(result, "usage_metadata", None)
        if isinstance(usage, dict):
            in_value = usage.get("input_tokens", usage.get("tokens_in", 0))
            out_value = usage.get("output_tokens", usage.get("tokens_out", 0))
            in_tokens = int(in_value) if in_value is not None else 0
            out_tokens = int(out_value) if out_value is not None else 0
            return in_tokens, out_tokens
        return 0, 0

    def _extract_usage_metadata_from_raw(self, raw_result: Any) -> tuple[int, int]:
        if isinstance(raw_result, dict):
            direct_usage = raw_result.get("usage_metadata")
            if isinstance(direct_usage, dict):
                return self._extract_usage_from_mapping(direct_usage)
            raw_payload = raw_result.get("raw")
            return self._extract_usage_metadata_from_raw_payload(raw_payload)
        return 0, 0

    def _extract_usage_metadata_from_raw_payload(self, raw_payload: Any) -> tuple[int, int]:
        if isinstance(raw_payload, dict):
            raw_usage = raw_payload.get("usage_metadata")
            if isinstance(raw_usage, dict):
                return self._extract_usage_from_mapping(raw_usage)
            response_meta = raw_payload.get("response_metadata")
            if isinstance(response_meta, dict):
                token_usage = response_meta.get("token_usage")
                if isinstance(token_usage, dict):
                    return self._extract_usage_from_mapping(token_usage)
            return 0, 0

        usage_attr = getattr(raw_payload, "usage_metadata", None)
        if isinstance(usage_attr, dict):
            return self._extract_usage_from_mapping(usage_attr)

        response_meta_attr = getattr(raw_payload, "response_metadata", None)
        if isinstance(response_meta_attr, dict):
            token_usage = response_meta_attr.get("token_usage")
            if isinstance(token_usage, dict):
                return self._extract_usage_from_mapping(token_usage)

        return 0, 0

    @staticmethod
    def _extract_usage_from_mapping(data: dict[str, Any]) -> tuple[int, int]:
        in_value = data.get("input_tokens", data.get("tokens_in", data.get("prompt_tokens", 0)))
        out_value = data.get(
            "output_tokens", data.get("tokens_out", data.get("completion_tokens", 0))
        )
        in_tokens = int(in_value) if in_value is not None else 0
        out_tokens = int(out_value) if out_value is not None else 0
        return in_tokens, out_tokens

    def _build_chain(
        self, provider: str, model: str, base_url: str | None
    ) -> StructuredOutputChain:
        chat_model = self._build_chat_model(provider=provider, model=model, base_url=base_url)
        return chat_model.with_structured_output(self.output_schema, include_raw=True)

    def _build_chat_model(self, provider: str, model: str, base_url: str | None) -> BaseChatModel:
        normalized = provider.strip().lower()
        if normalized == "anthropic":
            from langchain_anthropic import ChatAnthropic

            if base_url is not None:
                logger.warning("anthropic_base_url_ignored", provider=provider, model=model)
            return ChatAnthropic(
                model_name=model,
                temperature=self.config.temperature,
                timeout=self.config.timeout_seconds,
                max_retries=self.config.max_retries,
                stop=None,
            )

        if normalized in {"openai", "azure", "lmstudio"}:
            from langchain_openai import ChatOpenAI

            endpoint = base_url
            if normalized == "lmstudio" and endpoint is None:
                endpoint = "http://127.0.0.1:1234/v1"
            chat_kwargs: dict[str, Any] = {
                "model": model,
                "temperature": self.config.temperature,
                "timeout": self.config.timeout_seconds,
                "max_retries": self.config.max_retries,
                "base_url": endpoint,
                "max_tokens": self.config.max_tokens,
            }
            return ChatOpenAI(**chat_kwargs)
        raise LLMProviderError(f"unsupported_provider:{provider}")

    @staticmethod
    def _to_snapshot(value: BaseModel | dict[str, Any] | Any) -> dict[str, Any]:
        if isinstance(value, BaseModel):
            return value.model_dump(mode="json")
        if isinstance(value, dict):
            return value
        return {"value": value}

    @staticmethod
    def _duration_ms(started_at: datetime, completed_at: datetime) -> int:
        return int((completed_at - started_at).total_seconds() * 1000)
