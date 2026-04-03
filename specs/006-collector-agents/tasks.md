# Tasks: Collector Agents

**Input**: Design documents from `/specs/006-collector-agents/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | research.md ✅ | quickstart.md ✅
**Total Tasks**: 17

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- Exact file paths are included in every description

---

## Phase 1: Setup (Package Structure)

**Purpose**: Create test file stubs and ensure all directories exist. No logic yet.

- [ ] T001 Create `apps/api/tests/agents/test_watchdog.py` (empty module) and `apps/api/tests/agents/test_researcher.py` (empty module) in `apps/api/tests/agents/`
- [ ] T002 [P] Create `packages/shared/src/finsight/shared/models/research_packet.py` stub (empty module) in `packages/shared/src/finsight/shared/models/research_packet.py`

**Checkpoint**: All directories exist; existing Feature 005 test conftest still passes.

---

## Phase 2: Foundational (Config + ResearchPacket Model)

**Purpose**: `watchdog.yaml` schema update with news/dedup fields, and the `ResearchPacket`
Pydantic model that Researcher returns. Both required by both agents' tests.

**⚠️ CRITICAL**: No agent implementation can begin until this phase is complete.

- [ ] T003 Update `config/runtime/watchdog.yaml` to add:
  - `news_spike_rate_per_hour: 5` (articles/hour threshold for news volume alert)
  - `dedup_window_hours: 4` (no duplicate alert for same condition within this window)
  - Keep existing: `poll_interval_seconds`, `alert_cooldown_seconds`, `default_thresholds` (price_change_pct, volume_spike_multiplier, rsi_overbought)
  in `config/runtime/watchdog.yaml`
- [ ] T004 Update `config/schemas/watchdog.py` to add `news_spike_rate_per_hour: int = 5` and `dedup_window_hours: int = 4` to `WatchdogConfig`; `frozen=True` preserved in `config/schemas/watchdog.py`
- [ ] T005 Create `packages/shared/src/finsight/shared/models/research_packet.py` with:
  - Import sub-models from MCP server response types (replicated as shared models): `OHLCVBar(BaseModel)` (date, open, high, low, close, volume), `FundamentalsSnapshot(BaseModel)` (symbol, market_cap, pe_ratio, eps, revenue, sector — all nullable), `NewsItem(BaseModel)` (headline, source, url, published_at, relevance_score, summary — nullable fields), `KnowledgeSnippet(BaseModel)` (id, content, author_agent, confidence, tickers, tags, similarity_score)
  - `ResearchPacket(BaseModel)`:
    - `ticker: str`
    - `mission_id: UUID`
    - `price_history: list[OHLCVBar] | None = None`
    - `fundamentals: FundamentalsSnapshot | None = None`
    - `news_items: list[NewsItem] = []`
    - `kb_entries: list[KnowledgeSnippet] = []`
    - `data_gaps: list[str] = []` — populated when a tool returns no data (e.g., `"fundamentals: tool returned no data"`)
  - Export from `packages/shared/src/finsight/shared/models/__init__.py`
  in `packages/shared/src/finsight/shared/models/research_packet.py`
- [ ] T006 [P] Add `AlertRepository.get_recent(ticker: str, condition_keyword: str, window_hours: int) -> list[AlertORM]` method to `apps/api/src/api/db/repositories/alert.py` — queries alerts WHERE `trigger_condition ILIKE %condition_keyword%` AND `watchlist_item.ticker = ticker` AND `created_at > now() - interval '{window_hours} hours'` AND `deleted_at IS NULL`; used by Watchdog deduplication in `apps/api/src/api/db/repositories/alert.py`

**Checkpoint**: `ResearchPacket` importable from `finsight.shared.models`; `WatchdogConfig` has new fields; `AlertRepository.get_recent()` type-checks.

---

## Phase 3: User Story 1 — Watchdog Detects a Price Threshold Breach and Raises an Alert (Priority: P1) 🎯 MVP

**Goal**: `WatchdogAgent` evaluates price and volume thresholds for all active watchlist items.
On breach: creates `AlertORM` + `MissionORM`; deduplication prevents duplicate alerts; no LLM call.

**Independent Test**: `uv run pytest apps/api/tests/agents/test_watchdog.py -k "price or breach or dedup"` — all pass offline.

- [ ] T007 [US1] Create `apps/api/src/api/agents/watchdog_agent.prompt.py` containing only a module-level docstring:
  ```python
  """
  WatchdogAgent — Threshold Evaluator

  This agent makes no LLM calls. Alert descriptions are generated programmatically
  using f-strings from observed values and configured thresholds.

  Threshold evaluation logic:
  - Price: abs(current_price - prev_close) / prev_close >= threshold_pct / 100
  - Volume: current_volume >= avg_volume * multiplier
  - News: articles_per_hour >= news_spike_rate_per_hour threshold

  Per-item thresholds (WatchlistItem columns) take precedence over watchdog.yaml defaults.
  Null per-item threshold falls back to watchdog.yaml default.
  """
  ```
  in `apps/api/src/api/agents/watchdog_agent.prompt.py`
- [ ] T008 [US1] Create `apps/api/src/api/agents/watchdog_agent.py` with `WatchdogAgent`:
  - Does NOT extend `BaseAgent` (no LLM; custom run pattern)
  - `__init__(self, watchdog_config: WatchdogConfig, watchlist_repo: WatchlistItemRepository, alert_repo: AlertRepository, mission_repo: MissionRepository, mcp_client: MCPClient, agent_run_repo: AgentRunRepository)`
  - `async def run(self, mission_id: UUID) -> WatchdogResult`:
    1. Fetch all active watchlist items via `watchlist_repo.list_active()`
    2. For each item: call `self._call_tool("market.get_price", {"symbol": item.ticker})` and `self._call_tool("news.get_news", {"query": item.ticker})`
    3. Evaluate thresholds (per-item value takes precedence over yaml default when non-null)
    4. On price breach: f-string description e.g. `f"{item.ticker} price moved +{change_pct:.1f}% exceeding the {threshold:.1f}% threshold"`
    5. Dedup check: call `alert_repo.get_recent(ticker, condition_keyword, dedup_window_hours)` — if non-empty, skip
    6. Create `AlertORM` + `MissionORM` (source="alert", mission_type="alert", query=description)
    7. Record `AgentRunORM` via `agent_run_repo.create(cost_usd=Decimal("0.00"), tokens_in=0, tokens_out=0, ...)`
  - `_call_tool(tool_name, params) -> dict | None` — same pattern as BaseAgent (MCPClient + catch MCPToolError)
  - `_effective_threshold(item: WatchlistItemORM, yaml_default: float, item_field: str) -> float` — returns item field value if non-null, else yaml default
  - `WatchdogResult(BaseModel)`: `alerts_created: int`, `missions_opened: int`, `items_evaluated: int`, `dedup_skipped: int`
  in `apps/api/src/api/agents/watchdog_agent.py`
- [ ] T009 [US1] Write `apps/api/tests/agents/test_watchdog.py` US1 tests (mock all I/O):
  - Fixtures: `mock_watchlist_repo` (returns 2 active items), `mock_alert_repo`, `mock_mission_repo`, `mock_agent_run_repo`, `mock_mcp_client`, `watchdog_config` (from test WatchdogConfig)
  - `test_price_breach_creates_alert_and_mission` — mock `get_price` returning price 5% above prev_close (threshold=3%); assert `alert_repo.create()` called once; assert `mission_repo.create()` called once; assert `agent_run_repo.create(cost_usd=Decimal("0.00"))` called
  - `test_no_breach_creates_no_alert` — mock `get_price` returning price 1% move (threshold=3%); assert `alert_repo.create()` NOT called
  - `test_dedup_prevents_duplicate_alert` — mock `alert_repo.get_recent()` returns 1 existing alert; assert `alert_repo.create()` NOT called even though threshold exceeded
  - `test_multiple_items_evaluated_independently` — 2 watchlist items: one breaches, one doesn't; assert exactly 1 alert created
  - `test_per_item_threshold_overrides_yaml_default` — item has `price_alert_above=102.0` (specific price level); price=103.0 → breach; assert alert created
  - `test_mcp_tool_failure_skips_item_gracefully` — mock `get_price` raises MCPToolError; assert no exception propagates; assert no alert for that item; `items_evaluated` count still correct
  in `apps/api/tests/agents/test_watchdog.py`

**Checkpoint**: `uv run pytest apps/api/tests/agents/test_watchdog.py` — all 6 tests pass offline.

---

## Phase 4: User Story 2 — Researcher Assembles a Research Packet (Priority: P1)

**Goal**: `ResearcherAgent` calls 4 MCP tools (get_ohlcv, get_fundamentals, get_news, search_knowledge),
assembles all results into `ResearchPacket`, records absent data in `data_gaps`, and returns the
packet. No LLM call; no analytical content in output.

**Independent Test**: `uv run pytest apps/api/tests/agents/test_researcher.py` — all pass offline.

- [ ] T010 [P] [US2] Create `apps/api/src/api/agents/researcher_agent.prompt.py` with system prompt documenting the Researcher's role: data collector only, no analysis, all tool results assembled verbatim, absent data recorded in data_gaps; import `SYSTEM_ROLE_PREAMBLE` from `agents/shared/prompts.py` in `apps/api/src/api/agents/researcher_agent.prompt.py`
- [ ] T011 [US2] Create `apps/api/src/api/agents/researcher_agent.py` with `ResearcherAgent`:
  - Does NOT extend `BaseAgent` (no LLM; pure data assembly)
  - `__init__(self, agent_run_repo: AgentRunRepository, mcp_client: MCPClient)`
  - `async def run(self, input: ResearchInput, mission_id: UUID) -> ResearchPacket` where `ResearchInput(BaseModel)` has `ticker: str`, `mission_id: UUID`:
    1. `started_at = datetime.utcnow()`
    2. Call all 4 tools concurrently via `asyncio.gather()`:
       - `_call_tool("market.get_ohlcv", {"symbol": ticker, "period": "1mo"})`
       - `_call_tool("market.get_fundamentals", {"symbol": ticker})`
       - `_call_tool("news.get_news", {"query": ticker, "limit": 10})`
       - `_call_tool("knowledge.search_knowledge", {"query": ticker, "limit": 5})`
    3. Map results to `ResearchPacket` fields; if tool returned `None` → append to `data_gaps` (e.g., `"fundamentals: tool returned no data"`)
    4. Record `AgentRunORM` with `cost_usd=Decimal("0.00")`, `tokens_in=0`, `tokens_out=0`, `agent_name="researcher"`, `status="complete"`, `duration_ms`
    5. Return `ResearchPacket`
  - `_call_tool(tool_name, params) -> dict | None` — same pattern as BaseAgent; logs MCPToolError, returns None
  in `apps/api/src/api/agents/researcher_agent.py`
- [ ] T012 [US2] Write `apps/api/tests/agents/test_researcher.py` (mock all I/O):
  - Fixtures: `mock_agent_run_repo`, `mock_mcp_client` (returns fixture data for each tool)
  - `test_all_tools_called_concurrently` — assert `mock_mcp_client.call_tool` called exactly 4 times with correct tool names
  - `test_packet_fields_populated` — mock all 4 tools returning data; assert `packet.price_history` non-empty, `packet.fundamentals` not None, `packet.news_items` non-empty, `packet.kb_entries` non-empty, `packet.data_gaps == []`
  - `test_absent_news_recorded_in_data_gaps` — mock news tool returns None; assert `"news" in packet.data_gaps[0]`
  - `test_absent_fundamentals_recorded_in_data_gaps` — mock fundamentals returns None; assert data_gaps contains fundamentals entry
  - `test_no_analytical_fields_in_output` — assert `ResearchPacket` model fields do not include any field named `analysis`, `recommendation`, `conclusion`, `interpretation`, `opinion`
  - `test_agent_run_recorded_with_zero_cost` — assert `agent_run_repo.create(cost_usd=Decimal("0.00"), tokens_in=0)` called once
  - `test_partial_tool_failure_still_completes` — mock get_ohlcv raises MCPToolError; other tools succeed; assert packet returned with data_gaps containing "price_history" entry; no exception raised
  in `apps/api/tests/agents/test_researcher.py`

**Checkpoint**: `uv run pytest apps/api/tests/agents/test_researcher.py` — all 7 tests pass offline.

---

## Phase 5: User Story 3 — Watchdog Detects Unusual News Volume and Triggers Triage (Priority: P2)

**Goal**: `WatchdogAgent` extended with news-volume evaluation. News spike check uses
`news_spike_rate_per_hour` from watchdog.yaml config; alert raised at appropriate severity level.

**Independent Test**: `uv run pytest apps/api/tests/agents/test_watchdog.py -k "news"` — all pass offline.

- [ ] T013 [US3] Extend `apps/api/src/api/agents/watchdog_agent.py` — `_evaluate_news_volume(news_items: list[dict], threshold_per_hour: int, ticker: str) -> tuple[bool, str]`:
  - Count articles published in the last hour from the news_items list
  - If count >= threshold: return `(True, f"{ticker} news volume spike: {count} articles in last hour (threshold: {threshold_per_hour})")`
  - Else: return `(False, "")`
  - Call this check in `run()` for each watchlist item alongside price/volume checks; apply same dedup logic
  - Severity: LOW for 1–2x threshold, MEDIUM for 2–5x, HIGH for >5x (encoded as an `_assess_severity(ratio: float) -> str` method)
  in `apps/api/src/api/agents/watchdog_agent.py`
- [ ] T014 [US3] Add US3 tests to `apps/api/tests/agents/test_watchdog.py`:
  - `test_news_spike_creates_alert` — mock `get_news` returning 10 items all published within last hour (threshold=5/hour); assert alert created with "news volume spike" in trigger_condition
  - `test_normal_news_volume_no_alert` — mock `get_news` returning 2 items in last hour; assert no news-volume alert created
  - `test_news_spike_severity_high` — 30 articles/hour with threshold=5 (ratio=6x) → assert alert severity="critical" or "high"
  in `apps/api/tests/agents/test_watchdog.py`

**Checkpoint**: `uv run pytest apps/api/tests/agents/test_watchdog.py` — all 9 tests pass offline.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T015 [P] Run `uv run mypy --strict apps/api/src/api/agents/watchdog_agent.py apps/api/src/api/agents/researcher_agent.py packages/shared/src/finsight/shared/models/research_packet.py` — fix all type errors until zero errors remain
- [ ] T016 [P] Run `uv run ruff check apps/api/src/api/agents/watchdog_agent.py apps/api/src/api/agents/researcher_agent.py` — fix all warnings
- [ ] T017 Run full test suite: `uv run pytest apps/api/tests/agents/` — all 9+ watchdog tests + 7 researcher tests pass offline; confirm no real HTTP calls or DB connections

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001 and T002 parallel
- **Foundational (Phase 2)**: Depends on Phase 1; T003→T004 sequential; T005 parallel with T004; T006 parallel with T005
- **US1 (Phase 3)**: Depends on Phase 2 (WatchdogConfig, AlertRepository.get_recent); T007→T008→T009 sequential
- **US2 (Phase 4)**: Depends on T005 (ResearchPacket model); T010 parallel with T011; T012 after T011
- **US3 (Phase 5)**: Depends on T008 (WatchdogAgent exists); T013→T014 sequential
- **Polish (Phase 6)**: Depends on all phases; T015 and T016 parallel → T017

### User Story Dependencies

- **US1 (P1)**: Core Watchdog implementation — US3 extends it
- **US2 (P1)**: Independent of US1/US3 — different agent, different files
- **US3 (P2)**: Extends US1 (adds news volume check to WatchdogAgent)

### Parallel Execution Map

```
Phase 1: [T001, T002] parallel
Phase 2: T003 → T004; [T005, T006] parallel with T004
Phase 3: T007 → T008 → T009
Phase 4: [T010, T011] partially parallel → T012 (US2 fully parallel with Phase 3)
Phase 5: T013 → T014 (after US1 complete)
Phase 6: [T015, T016] → T017
```

---

## Parallel Example: US1 + US2 (After Foundational)

```
# Watchdog and Researcher are fully independent implementations:
Workstream A (US1): T007 (prompt.py) → T008 (watchdog_agent.py) → T009 (test_watchdog.py)
Workstream B (US2): T010 (researcher prompt) + T011 (researcher_agent.py) → T012 (test_researcher.py)
```

---

## Implementation Strategy

### MVP First (User Story 1 — Watchdog Price Breach)

1. Complete Phase 1: Setup (stubs)
2. Complete Phase 2: Foundational (config, ResearchPacket, AlertRepository.get_recent)
3. Complete Phase 3: US1 (WatchdogAgent price+volume threshold + 6 tests)
4. **STOP and VALIDATE**: `uv run pytest apps/api/tests/agents/test_watchdog.py` — all pass
5. Automated alert creation is working — Feature 008 can connect it to Celery

### Incremental Delivery

1. Setup + Foundational → config and shared models ready
2. US1 → Watchdog price/volume alerts → primary trigger pipeline operational
3. US2 → Researcher assembles data packets → Feature 007 reasoning agents can start
4. US3 → Watchdog news volume → earlier signal detection

---

## Notes

- Tests are **required** by spec (FR-008: both agents testable offline)
- **Watchdog has NO LLM call** — does not extend `BaseAgent`; implements its own `_call_tool()` helper inline (same MCPClient pattern); `cost_usd=Decimal("0.00")` always in AgentRun
- **Researcher has NO LLM call** — pure data assembly; `cost_usd=Decimal("0.00")` always in AgentRun
- `asyncio.gather()` in ResearcherAgent — all 4 tool calls are concurrent; if one raises MCPToolError it is caught individually (not via `return_exceptions=True`) to allow partial success
- `WatchlistItem` has per-item threshold columns (`price_alert_above`, `price_alert_below`, `volume_spike_multiplier`, `rsi_overbought`, `rsi_oversold`) from Feature 002 data-model — these take precedence over watchdog.yaml global defaults when non-null
- Alert severity mapping in `_assess_severity`: ratio < 2 → "info", 2–5 → "warning", >5 → "critical"
- `watchdog_agent.prompt.py` is a module docstring only — no actual prompt string exported; this satisfies the US4 colocated prompt pattern from Feature 005 structurally
- `researcher_agent.prompt.py` imports `SYSTEM_ROLE_PREAMBLE` from shared prompts and defines `RESEARCHER_SYSTEM_PROMPT` (even though no LLM is called, the file documents the agent's charter)
- The Researcher calls tools via `_call_tool()` method defined inline (same as Watchdog); `MCPClient` is injected
