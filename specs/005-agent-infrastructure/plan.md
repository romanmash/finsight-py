# Implementation Plan: Agent Infrastructure

**Branch**: `005-agent-infrastructure` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Build the shared agent infrastructure that all 7 agents extend: a `BaseAgent` abstract class
handling LLM invocation, output validation with retry-once, AgentRun cost recording
(tokens_in/out/cost_usd/provider/model/duration_ms), LangSmith tracing, provider fallback, and
the shared MCP client wrapper. Establish the colocated prompt file pattern and the pricing
registry loaded from pricing.yaml. All tested offline with mocked LLM responses.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: langchain-core, langchain-openai, langgraph, langsmith, structlog, pydantic>=2.0
**Storage**: PostgreSQL (AgentRun records via Feature 002 repositories)
**Testing**: pytest + pytest-asyncio + unittest.mock (offline)
**Target Platform**: Linux server (Docker) + Windows dev (Podman)
**Project Type**: Python monorepo sub-package (apps/api)
**Performance Goals**: AgentRun record created within 100 ms of run completion
**Constraints**: mypy --strict; offline tests; no real LLM calls in tests; unknown model → cost=0 + warning
**Scale/Scope**: 7 agents all inherit from BaseAgent

## Constitution Check

- [x] Everything-as-Code — model names, providers, fallback config in config/runtime/agents.yaml; costs in pricing.yaml
- [x] Agent Boundaries — BaseAgent enforces: one LLM call per invocation; typed input/output
- [x] MCP Server Independence — MCPClient used by agents; servers remain independent
- [x] Cost Observability — every LLM call records tokens_in/out/cost_usd/provider/model/duration_ms
- [x] Fail-Safe Defaults — malformed output → retry once → fail mission; unknown model → $0 + warning
- [x] Test-First — all base agent behaviour tested with mocked LLM and mocked AgentRunRepository
- [x] Simplicity Over Cleverness — no agent framework beyond BaseAgent + LangGraph node interface

## Project Structure

### Source Code

```text
apps/api/src/api/agents/
├── __init__.py
├── base.py              # BaseAgent abstract class
└── shared/
    └── prompts.py       # Shared prompt fragments (system role, formatting)

apps/api/src/api/lib/
├── pricing.py           # PricingRegistry: cost from pricing.yaml
└── tracing.py           # LangSmith client wrapper (optional in test env)

apps/api/src/api/mcp/
└── client.py            # MCPClient (created in Feature 004, referenced here)

config/runtime/
├── agents.yaml          # per-agent: model, provider, fallback_provider, fallback_model
└── pricing.yaml         # per-model: cost_per_1k_input, cost_per_1k_output

config/schemas/
├── agents.py            # Pydantic schema for agents.yaml
└── pricing.py           # Pydantic schema for pricing.yaml

apps/api/tests/agents/
├── conftest.py          # Fixtures: mock AgentRunRepo, mock LLM, mock MCPClient
└── test_base.py         # Tests: cost recording, retry, fallback, unknown model
```

## Implementation Phases

### Phase 1: Config Schemas

**Files**: `config/runtime/agents.yaml`, `config/schemas/agents.py`, `config/runtime/pricing.yaml`, `config/schemas/pricing.py`

**Key decisions**:
- `agents.yaml`: `agents.{name}.model`, `agents.{name}.provider`, `agents.{name}.fallback_model`, `agents.{name}.fallback_provider`
- `pricing.yaml`: `models.{model_name}.cost_per_1k_input_usd`, `models.{model_name}.cost_per_1k_output_usd`

### Phase 2: Pricing Registry

**Files**: `apps/api/src/api/lib/pricing.py`

**Key decisions**:
- `PricingRegistry.compute_cost(model, tokens_in, tokens_out) -> Decimal`
- Unknown model → `Decimal("0.00")` + `structlog.warn("unknown model in pricing registry")`

### Phase 3: LangSmith Wrapper

**Files**: `apps/api/src/api/lib/tracing.py`

**Key decisions**:
- Wraps `langsmith.Client`; no-ops when `LANGCHAIN_TRACING_V2` env var is absent
- Used by BaseAgent to create/update run traces

### Phase 4: BaseAgent

**Files**: `apps/api/src/api/agents/base.py`

**Key decisions**:
- `BaseAgent` is an abstract class with `async def run(self, input: InputT) -> OutputT`
- Internal `_invoke_llm(prompt)` handles: LLM call → parse response → validate against `output_schema` → if invalid retry once → if still invalid raise `AgentOutputError`
- Cost computed via `PricingRegistry` from response usage metadata
- `AgentRun` record written to DB via injected `AgentRunRepository`
- Primary provider from agents.yaml; fallback invoked if primary raises `LLMProviderError`

### Phase 5: Colocated Prompt Pattern

**Files**: `apps/api/src/api/agents/shared/prompts.py`

**Key decisions**:
- Shared fragments: `SYSTEM_ROLE_PREAMBLE`, `OUTPUT_FORMAT_INSTRUCTIONS`
- Each agent's prompt file (`x_agent.prompt.py`) imports from shared and defines agent-specific instructions

### Phase 6: Tests

**Files**: `apps/api/tests/agents/test_base.py`

- Mock LLM returns pre-set JSON; verify AgentRun record created with correct costs
- Mock LLM returns invalid JSON on first call, valid on second; verify single retry triggered
- Mock LLM returns invalid JSON twice; verify `AgentOutputError` raised, mission marked failed
- Mock unknown model in pricing; verify cost=0 and warning logged

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM client | langchain-openai ChatOpenAI | Supports both OpenAI-compatible local (LM Studio) and cloud |
| Output validation | Pydantic model_validate(response_json) | Same Pydantic models used everywhere |
| Retry policy | Retry once (exactly) | Constitution: retry once then fail mission |
| Cost precision | Python Decimal | Avoids float rounding errors on cost totals |
| LangSmith | Optional (no-op when unavailable) | Constitution: "never block" on observability |

## Testing Strategy

- All LLM calls mocked with `unittest.mock.AsyncMock`
- AgentRunRepository mocked; verify `create()` called with correct field values
- Pricing tests: known model → deterministic cost; unknown model → $0 + log
- Fallback test: primary raises exception → fallback provider called

## Dependencies

- **Requires**: 002 (AgentRun repository), 004 (MCPClient)
- **Required by**: 006-collector-agents, 007-reasoning-agents, 008-orchestration
