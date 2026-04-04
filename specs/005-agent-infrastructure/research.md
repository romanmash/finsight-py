# Research: Agent Infrastructure

## Decision: LangGraph as agent orchestration framework

**Chosen**: LangGraph Python (`langgraph`)
**Rationale**: LangGraph provides a `StateGraph` with typed state, node functions, conditional edges, and built-in checkpointing. Each agent becomes a LangGraph node — a typed async function `(State) -> State`. The supervisor graph (Feature 008) connects agents as nodes; Feature 005 only needs the base node interface and StateGraph setup helpers.
**Alternatives considered**:
- CrewAI: Higher-level abstraction hides the graph structure. Less control over state typing. Rejected.
- Custom message-passing: Reinventing a graph executor. Rejected.

---

## Decision: LLM provider abstraction

**Chosen**: LangChain `BaseChatModel` interface with a provider-agnostic adapter layer. Initial implementation uses `langchain-openai` because it supports OpenAI-compatible endpoints (including local runtimes), but `BaseAgent` depends only on the abstract chat-model contract, not any single vendor SDK.
**Rationale**: `BaseChatModel` is the standard interface for all LangChain-compatible LLM providers. Switching provider requires only changing `agents.yaml` (and adapter wiring), without changing agent business logic. The `with_structured_output()` method handles Pydantic output validation natively.
**Alternatives considered**:
- Direct OpenAI SDK: Would require separate code paths per provider. Rejected.
- LiteLLM: Another abstraction layer on top of LangChain. Unnecessary complexity. Rejected.

---

## Decision: Cost tracking persistence

**Chosen**: Write `AgentRun` record to PostgreSQL via SQLAlchemy 2.x async session inside `BaseAgent.run()`. Fields aligned with Feature 002: `id` (UUID), `mission_id` (UUID, required), `agent_name` (str), `status` (`running|completed|failed`), `input_snapshot` (JSONB), `output_snapshot` (JSONB), `tokens_in` (int), `tokens_out` (int), `cost_usd` (Decimal), `provider` (str | None), `model` (str | None), `duration_ms` (int | None), `error_message` (str | None), `started_at` (datetime), `completed_at` (datetime | None).
**Rationale**: Persisting to the same PostgreSQL as other domain models keeps observability data queryable by the dashboard (Feature 010). The `AgentRun` ORM model is defined in Feature 002 (data layer); Feature 005 just writes to it.
**Alternatives considered**:
- Write to a separate time-series DB: Overkill. The dashboard needs SQL joins. Rejected.
- Log-only (structlog): Not queryable by the dashboard. Rejected.

---

## Decision: LangSmith tracing integration

**Chosen**: LangSmith via the `langsmith` Python SDK. Traces are emitted automatically when `LANGCHAIN_API_KEY` and `LANGCHAIN_TRACING_V2=true` are set in `.env`. In test environments, these env vars are absent and tracing is silently skipped. A thin `tracing.py` wrapper provides `get_tracer()` returning either a real `LangSmithClient` or a no-op stub.
**Rationale**: LangSmith integrates with LangChain's callback system — no instrumentation code in agents beyond using LangChain's `BaseChatModel`. The no-op stub pattern ensures offline tests never attempt network calls.
**Alternatives considered**:
- OpenTelemetry + Jaeger: More portable but requires custom span instrumentation for each LLM call. Rejected.
- Logging only: Not visual; cannot replay call sequences. Rejected.

---

## Decision: Pricing registry format

**Chosen**: `config/runtime/pricing.yaml` with structure:
```yaml
models:
  openai/gpt-4o:
    input_cost_per_1k: 0.005
    output_cost_per_1k: 0.015
  lmstudio/llama-3.2-3b:
    input_cost_per_1k: 0.0
    output_cost_per_1k: 0.0
```
Loaded at startup into a `PricingConfig` Pydantic v2 model. `pricing.py` exposes `compute_cost(model, tokens_in, tokens_out) -> Decimal`. Unknown model logs a `structlog` warning and returns `Decimal("0.00")`.
**Rationale**: YAML is readable and editable without code changes. Pydantic v2 validation catches malformed entries at startup. Returning zero for unknown models (with warning) satisfies FR-003 — never block execution.
**Alternatives considered**:
- Hardcoded dict in Python: Violates Everything-as-Code. Rejected.
- Database table: Requires a DB migration for every new model. YAML is faster to update. Rejected.

---

## Decision: Agent output validation and retry policy

**Chosen**: LangChain `with_structured_output(OutputSchema, include_raw=True)`. On `ValidationError`, retry once with an error-correction prompt appended. If second attempt fails, raise `AgentOutputError` caught in `BaseAgent.run()`, which marks the `AgentRun` as failed.
**Rationale**: `with_structured_output` handles JSON extraction and Pydantic validation in one call. `include_raw=True` gives access to the raw LLM response for the retry prompt. One retry is the spec-mandated policy — no infinite loops.
**Alternatives considered**:
- `instructor` library: Adds a dependency; `with_structured_output` achieves the same result. Rejected.
- Manual JSON extraction with regex: Brittle. Rejected.

---

## Decision: Prompt colocation pattern

**Chosen**: Each agent module `x_agent.py` has a sibling `x_agent.prompt.py` containing a single `SYSTEM_PROMPT: str` constant and optionally a `build_user_prompt(context: SomeType) -> str` function. Shared fragments in `agents/shared/prompts.py` as named string constants imported by agent prompt files.
**Rationale**: Colocated prompt files are discoverable, diff-able in git, and importable as plain Python. No database, no file I/O at runtime.
**Alternatives considered**:
- Jinja2 template files: Adds a templating dependency; string f-strings and constants are sufficient. Rejected.
- Prompts in YAML config: Prompts are code, not configuration. They must be version-controlled alongside the agent. Rejected.

---

## Decision: Offline test fixtures for LLM responses

**Chosen**: Recorded response dicts in `tests/agents/fixtures/` as `.py` files containing typed `dict[str, Any]` constants matching `BaseChatModel` response structure. Injected via `unittest.mock.AsyncMock` on `BaseChatModel.ainvoke`.
**Rationale**: Pure Python fixtures — no serialization format to manage, fully type-checkable, no network required. `AsyncMock` patches are applied with `pytest.monkeypatch` or `@patch` decorators in test modules.
**Alternatives considered**:
- VCR cassettes: Require real network at record time. Rejected (offline-first).
- httpx respx: Correct for HTTP-level mocking but LangChain's `ainvoke` is Python-level, not HTTP-level in all providers. Using `AsyncMock` is simpler and more direct. Accepted as complement (respx still used for MCP client HTTP calls).
