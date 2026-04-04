# Tasks: Agent Infrastructure

**Input**: Design documents from `/specs/005-agent-infrastructure/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | research.md ✅ | quickstart.md ✅
**Total Tasks**: 20

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to ([US1]–[US4])
- Exact file paths are included in every description

---

## Phase 1: Setup (Package Structure)

**Purpose**: Create all `__init__.py` stubs and test directories. No logic yet — scaffolding only.

- [ ] T001 Create `apps/api-service/src/api/agents/__init__.py` (empty) and `apps/api-service/src/api/agents/shared/__init__.py` (empty) in `apps/api-service/src/api/agents/`
- [ ] T002 [P] Create `apps/api-service/tests/agents/__init__.py` (empty) in `apps/api-service/tests/agents/__init__.py`
- [ ] T003 [P] Add `langchain-core`, `langchain-openai`, `langsmith` to `apps/api-service/pyproject.toml` dependencies (if not already present) in `apps/api-service/pyproject.toml`

**Checkpoint**: `from api.agents import *` imports without error; test directory exists.

---

## Phase 2: Foundational (Config + Pricing Registry + Tracing)

**Purpose**: `agents.yaml` schema update, `PricingRegistry`, and LangSmith tracing wrapper must
exist before `BaseAgent` can be written. These are shared by all agents.

**⚠️ CRITICAL**: All user story work depends on this phase.

- [ ] T004 Update `config/runtime/agents.yaml` to add `fallback_model` and `fallback_provider` fields to each of the 9 agent definitions (manager, watchdog, screener, researcher, analyst, technician, bookkeeper, reporter, trader); keep existing fields (model, provider, temperature, max_tokens, max_retries, timeout_seconds, base_url) in `config/runtime/agents.yaml`
- [ ] T005 Update `config/schemas/agents.py` to add `fallback_model: str | None = None` and `fallback_provider: str | None = None` to `AgentConfig` — both nullable so agents without a fallback are valid; `frozen=True` preserved in `config/schemas/agents.py`
- [ ] T006 Create `apps/api-service/src/api/lib/pricing.py` with `PricingRegistry`:
  - `__init__(self, config: PricingConfig)` — stores the config
  - `compute_cost(self, model: str, tokens_in: int, tokens_out: int) -> Decimal`:
    - Look up `f"provider/{model}"` or just `model` key in `config.models`
    - If found: `Decimal(str(tokens_in)) * pricing.input_cost_per_1k / 1000 + Decimal(str(tokens_out)) * pricing.output_cost_per_1k / 1000`
    - If not found: log `structlog.warning("unknown_model_in_pricing_registry", model=model)` → return `Decimal("0.00")`
  - `get_registry(configs: AllConfigs) -> PricingRegistry` factory function
  in `apps/api-service/src/api/lib/pricing.py`
- [ ] T007 [P] Create `apps/api-service/src/api/lib/tracing.py` with LangSmith tracing wrapper:
  - `TracingClient` class with `enabled: bool` (True when `LANGCHAIN_TRACING_V2 == "true"`)
  - `create_run(name, inputs) -> str | None` — creates LangSmith run; returns run_id or None if disabled/error
  - `end_run(run_id, outputs, error) -> None` — ends run; no-op if run_id is None
  - All LangSmith errors caught and logged via structlog (never propagate — "never block on observability")
  in `apps/api-service/src/api/lib/tracing.py`
- [ ] T008 Create `apps/api-service/tests/agents/conftest.py` with shared fixtures for all agent tests:
  - `mock_agent_run_repo` — `AsyncMock` of `AgentRunRepository` with `create()` returning a pre-built `AgentRunORM`
  - `mock_mcp_client` — `AsyncMock` of `MCPClient` with `call_tool()` returning fixture data
  - `mock_llm_chain` — `AsyncMock` that returns a pre-built Pydantic output instance (used as `with_structured_output` return value)
  - `pricing_registry` — `PricingRegistry` instantiated from a test `PricingConfig` with known model prices
  - `agent_configs` — `AgentsConfig` loaded from test YAML fixture with all 9 agents
  in `apps/api-service/tests/agents/conftest.py`

**Checkpoint**: `PricingRegistry.compute_cost("gpt-4o-mini", 1000, 500)` returns correct `Decimal`; tracing no-ops when env var absent.

---

## Phase 3: User Story 1 — Agent Executes a Task and Run Is Recorded (Priority: P1) 🎯 MVP

**Goal**: `BaseAgent` abstract class fully implemented with `run()` method, LLM invocation,
`AgentRun` record creation (tokens_in/out, cost_usd, provider, model, duration_ms), and
LangSmith tracing. One concrete stub agent confirms the base class works end-to-end.

**Independent Test**: `uv run pytest apps/api-service/tests/agents/test_base.py::test_run_creates_agent_run_record` — passes offline.

- [ ] T009 [US1] Create `apps/api-service/src/api/agents/base.py` with `BaseAgent[InputT, OutputT]` abstract class:
  - `__init__(self, config: AgentConfig, session: AsyncSession, agent_run_repo: AgentRunRepository, mcp_client: MCPClient, pricing: PricingRegistry, tracer: TracingClient)` — all dependencies injected
  - `@property @abstractmethod name(self) -> str`
  - `@property @abstractmethod output_schema(self) -> type[OutputT]`
  - `@abstractmethod async def _build_prompt(self, input: InputT) -> str` — implemented by each concrete agent
  - `async def run(self, input: InputT, mission_id: UUID) -> OutputT`:
    1. Record `started_at = datetime.utcnow()`
    2. `run_id = tracer.create_run(self.name, input)`
    3. Build `ChatOpenAI(model=config.model, base_url=config.base_url or None)` chain via `with_structured_output(self.output_schema)`
    4. Try: `result = await chain.ainvoke(prompt)` (primary provider)
    5. On `LLMProviderError`: try fallback provider if configured; else re-raise
    6. Extract `usage_metadata` from callback: `tokens_in`, `tokens_out`
    7. `cost_usd = pricing.compute_cost(config.model, tokens_in, tokens_out)`
    8. `duration_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)`
    9. `await agent_run_repo.create({mission_id, agent_name=self.name, status="complete", tokens_in, tokens_out, cost_usd, provider, model, duration_ms, output_snapshot})`
    10. `tracer.end_run(run_id, outputs=result.model_dump(), error=None)`
    11. Return `result`
  - `AgentOutputError(Exception)` defined in same file with `agent_name: str`, `detail: str`
  in `apps/api-service/src/api/agents/base.py`
- [ ] T010 [US1] Write US1 tests in `apps/api-service/tests/agents/test_base.py`:
  - `test_run_creates_agent_run_record` — mock LLM returns valid output instance; assert `agent_run_repo.create()` called once with correct `tokens_in`, `tokens_out`, `cost_usd` (matches pricing registry calculation), `provider`, `model`, `duration_ms > 0`, `status="complete"`
  - `test_run_cost_matches_pricing_registry` — mock LLM returns 1000 input + 500 output tokens on a known-price model; assert `cost_usd == Decimal("expected")` exactly
  - `test_run_with_langsmith_tracing` — patch `TracingClient.create_run` and `end_run`; assert both called once with correct args
  - `test_run_unknown_model_cost_is_zero` — use unknown model name in config; assert `cost_usd == Decimal("0.00")` and structlog warning emitted
  in `apps/api-service/tests/agents/test_base.py`

**Checkpoint**: `uv run pytest apps/api-service/tests/agents/test_base.py -k "run_creates or cost or tracing or unknown"` — all 4 pass offline.

---

## Phase 4: User Story 2 — Agent Calls a Tool via MCP Client and Receives Typed Response (Priority: P1)

**Goal**: `BaseAgent._call_tool()` helper wraps `MCPClient.call_tool()`, catches `MCPToolError`,
and surfaces errors without raising unhandled exceptions. Tested with mock MCPClient.

**Independent Test**: `uv run pytest apps/api-service/tests/agents/test_base.py -k "tool"` — all pass offline.

- [ ] T011 [US2] Add `async def _call_tool(self, tool_name: str, params: dict) -> dict | None` to `BaseAgent` in `apps/api-service/src/api/agents/base.py`:
  - Calls `await self.mcp_client.call_tool(tool_name, params)`
  - On `MCPToolError`: log `structlog.error("mcp_tool_error", tool=tool_name, detail=str(e))`; return `None`
  - On success: return the result dict
  - This keeps agent code clean: `result = await self._call_tool("market.get_price", {"symbol": "AAPL"})`
  in `apps/api-service/src/api/agents/base.py`
- [ ] T012 [US2] Add US2 tests to `apps/api-service/tests/agents/test_base.py`:
  - `test_call_tool_success` — mock MCPClient returns fixture dict; assert `_call_tool` returns same dict
  - `test_call_tool_mcp_error_returns_none` — mock MCPClient raises `MCPToolError`; assert `_call_tool` returns None (no exception propagated)
  - `test_call_tool_timeout_returns_none` — mock MCPClient raises `MCPToolError` with timeout detail; assert None returned and error logged
  in `apps/api-service/tests/agents/test_base.py`

**Checkpoint**: `uv run pytest apps/api-service/tests/agents/test_base.py -k "call_tool"` — all 3 pass offline.

---

## Phase 5: User Story 3 — Agent Output Is Validated with Retry (Priority: P1)

**Goal**: `BaseAgent._invoke_llm_with_retry()` validates LLM output against `output_schema`;
on failure retries exactly once; on second failure raises `AgentOutputError` and marks the
AgentRun failed. All tested offline with mock LLM returning invalid/valid JSON in sequence.

**Independent Test**: `uv run pytest apps/api-service/tests/agents/test_base.py -k "retry or validation or output"` — all pass.

- [ ] T013 [US3] Refactor `BaseAgent.run()` in `apps/api-service/src/api/agents/base.py` to extract `_invoke_llm_with_retry(prompt, chain) -> OutputT`:
  - Attempt 1: `result = await chain.ainvoke(prompt)` — if `ValidationError` caught: attempt 2
  - Attempt 2: same call — if `ValidationError` again: call `agent_run_repo.create(status="failed", error_message=str(e))` + `tracer.end_run(run_id, error=str(e))` + raise `AgentOutputError(agent_name=self.name, detail=str(e))`
  - Valid result on either attempt: return parsed `OutputT` instance
  - Note: `with_structured_output` returns a `RunnableSequence`; mock in tests using `patch.object(ChatOpenAI, "with_structured_output", return_value=mock_chain)` where `mock_chain = AsyncMock(return_value=output_instance)`
  in `apps/api-service/src/api/agents/base.py`
- [ ] T014 [US3] Add US3 tests to `apps/api-service/tests/agents/test_base.py`:
  - `test_valid_output_accepted_no_retry` — mock chain returns valid Pydantic instance; assert `agent_run_repo.create()` called once with `status="complete"`; assert chain.ainvoke called exactly once
  - `test_invalid_output_triggers_one_retry` — mock chain raises `ValidationError` on first call, returns valid instance on second; assert `chain.ainvoke` called exactly twice; assert `status="complete"` in AgentRun
  - `test_two_invalid_outputs_marks_failed` — mock chain raises `ValidationError` on both calls; assert `AgentOutputError` raised; assert `agent_run_repo.create(status="failed", error_message=...)` called; assert `chain.ainvoke` called exactly twice (no third attempt)
  in `apps/api-service/tests/agents/test_base.py`

**Checkpoint**: `uv run pytest apps/api-service/tests/agents/test_base.py -k "retry or valid or invalid or failed"` — all pass offline.

---

## Phase 6: User Story 4 — Agent Prompts Are Colocated and Versioned (Priority: P2)

**Goal**: Shared prompt fragments in `agents/shared/prompts.py`; a concrete stub agent
(`StubAgent`) demonstrates the colocated prompt pattern with a `stub_agent.prompt.py` file.
No real agent logic — this is the structural pattern all Feature 006/007 agents will follow.

**Independent Test**: Verify `StubAgent` prompt file exists alongside `stub_agent.py`; verify shared fragments importable from `agents/shared/prompts.py`.

- [ ] T015 [US4] Create `apps/api-service/src/api/agents/shared/prompts.py` with shared prompt fragments:
  - `SYSTEM_ROLE_PREAMBLE: str` — introductory system role description for all FinSight agents
  - `OUTPUT_FORMAT_INSTRUCTIONS: str` — standard instructions for JSON output format
  - `ANALYSIS_CONSTRAINTS: str` — shared constraints (no investment advice, data only, cite sources)
  in `apps/api-service/src/api/agents/shared/prompts.py`
- [ ] T016 [US4] Create stub agent to validate the colocated pattern:
  - `apps/api-service/src/api/agents/stub_agent.prompt.py` — imports from `agents/shared/prompts.py`; defines `STUB_SYSTEM_PROMPT: str`
  - `apps/api-service/src/api/agents/stub_agent.py` — `StubAgent(BaseAgent[StubInput, StubOutput])` where `StubInput(BaseModel)` has `query: str` and `StubOutput(BaseModel)` has `answer: str`; `name = "stub"`; `output_schema = StubOutput`; `_build_prompt(input) -> str` loads from `.prompt.py`
  in `apps/api-service/src/api/agents/stub_agent.py` and `apps/api-service/src/api/agents/stub_agent.prompt.py`
- [ ] T017 [P] [US4] Add US4 tests to `apps/api-service/tests/agents/test_base.py`:
  - `test_prompt_file_colocated_with_agent` — assert `Path("apps/api-service/src/api/agents/stub_agent.prompt.py").exists()` is True
  - `test_shared_prompt_fragments_importable` — `from api.agents.shared.prompts import SYSTEM_ROLE_PREAMBLE` — assert non-empty string
  - `test_stub_agent_uses_shared_prompts` — assert `SYSTEM_ROLE_PREAMBLE in StubAgent.SYSTEM_PROMPT` or that `stub_agent.prompt.py` imports from `shared.prompts`
  in `apps/api-service/tests/agents/test_base.py`

**Checkpoint**: `uv run pytest apps/api-service/tests/agents/test_base.py -k "prompt or colocated or stub"` — all pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T018 [P] Add US1 fallback provider test to `apps/api-service/tests/agents/test_base.py`:
  - `test_primary_provider_failure_uses_fallback` — configure agent with `fallback_provider="openai"`, `fallback_model="gpt-4o-mini"`; mock primary chain to raise `Exception("provider unavailable")`; mock fallback chain to return valid output; assert final result is valid and `agent_run_repo.create()` called with fallback model name
  in `apps/api-service/tests/agents/test_base.py`
- [ ] T019 [P] Run `uv run mypy --strict apps/api-service/src/api/agents/ apps/api-service/src/api/lib/pricing.py apps/api-service/src/api/lib/tracing.py` — fix all type errors until zero errors remain
- [ ] T020 Run full test suite: `uv run pytest apps/api-service/tests/agents/` (all offline, all pass) + `uv run ruff check apps/api-service/src/api/agents/ apps/api-service/src/api/lib/pricing.py apps/api-service/src/api/lib/tracing.py` (zero warnings)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001–T003 parallelisable
- **Foundational (Phase 2)**: Depends on Phase 1; T004→T005 sequential (schema update); T006 after T005 (needs PricingConfig); T007 parallel with T006; T008 after T006+T007 (fixtures need PricingRegistry)
- **US1 (Phase 3)**: Depends on all of Phase 2; T009 (BaseAgent) before T010 (tests)
- **US2 (Phase 4)**: Depends on T009 (BaseAgent exists); T011→T012 sequential
- **US3 (Phase 5)**: Depends on T009 (BaseAgent exists); T013 refactors run(), T014 adds tests
- **US4 (Phase 6)**: Depends on T009 (needs BaseAgent for StubAgent); T015→T016→T017 sequential
- **Polish (Phase 7)**: Depends on all phases; T018 and T019 parallel → T020

### User Story Dependencies

- **US1 (P1)**: Core — creates BaseAgent; all other stories extend it
- **US2 (P1)**: Depends on T009 (adds `_call_tool` to BaseAgent); parallel-safe with US3 (different methods)
- **US3 (P1)**: Depends on T009 (refactors `run()` validation logic); parallel-safe with US2
- **US4 (P2)**: Depends on T009 (StubAgent extends BaseAgent); fully independent of US2/US3

### Parallel Execution Map

```
Phase 1: [T001, T002, T003] parallel
Phase 2: T004 → T005 → T006; T007 parallel with T006; T008 after T006+T007
Phase 3: T009 → T010
Phase 4+5: T011→T012 and T013→T014 parallel (different methods on BaseAgent)
Phase 6: T015 → T016 → T017
Phase 7: [T018, T019] parallel → T020
```

---

## Parallel Example: US2 + US3 (After US1 BaseAgent Exists)

```
# Both add behaviour to BaseAgent but touch different methods:
Workstream A (US2): T011 add _call_tool() → T012 write tool call tests
Workstream B (US3): T013 refactor _invoke_llm_with_retry() → T014 write retry tests
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (pricing, tracing, test conftest)
3. Complete Phase 3: US1 (`BaseAgent.run()` + cost recording + 4 tests)
4. **STOP and VALIDATE**: `uv run pytest apps/api-service/tests/agents/test_base.py -k "run_creates or cost"` — pass
5. BaseAgent is ready; Feature 006 agents can extend it immediately

### Incremental Delivery

1. Setup + Foundational → pricing, tracing, fixtures ready
2. US1 → BaseAgent.run() + AgentRun recording → Feature 006/007 can start
3. US2 → `_call_tool()` helper → collector agents (Feature 006) can call MCP tools
4. US3 → retry-on-invalid-output → output validation safety net in place
5. US4 → prompt pattern documented + StubAgent → Feature 006/007 agents follow the pattern

---

## Notes

- Tests are **required** by spec (FR-009: all agent infrastructure behaviour testable offline)
- `with_structured_output` mock pattern (critical): `patch.object(ChatOpenAI, "with_structured_output", return_value=AsyncMock(return_value=output_instance))` — patching `ChatOpenAI.ainvoke` directly does NOT work because `with_structured_output` returns a `RunnableSequence`
- `chain.ainvoke` call count assertions: use `mock_chain.ainvoke.call_count` not `mock_chain.call_count`
- `BaseAgent` is generic `BaseAgent[InputT, OutputT]` — mypy --strict requires `TypeVar` declarations
- `AgentOutputError` is raised by BaseAgent and caught by the LangGraph mission worker (Feature 008)
- `StubAgent` in `stub_agent.py` is for testing the infrastructure pattern only — it is NOT a production agent; it will coexist with production agents in Feature 006+
- `PricingRegistry.compute_cost()` uses `Decimal` arithmetic throughout — do not mix with `float`
- LangSmith tracing is always a no-op if `LANGCHAIN_TRACING_V2` is not `"true"` — no test breakage from missing LangSmith credentials
- `base_url: str | None` in `AgentConfig` is passed as `ChatOpenAI(model=..., base_url=config.base_url)` — when `None`, LangChain uses the provider default URL; enables LM Studio support without code changes
