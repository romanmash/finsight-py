# Tasks: Reasoning Agents

**Input**: Design documents from `/specs/007-reasoning-agents/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | research.md ✅ | quickstart.md ✅
**Total Tasks**: 21

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to ([US1]–[US4])
- Exact file paths are included in every description

---

## Phase 1: Setup (Stubs)

**Purpose**: Create empty modules so imports resolve before implementations are written.

- [ ] T001 Create stub modules: `packages/shared/src/finsight/shared/models/assessment.py`, `packages/shared/src/finsight/shared/models/pattern_report.py`, `packages/shared/src/finsight/shared/models/report.py` (all empty) in `packages/shared/src/finsight/shared/models/`
- [ ] T002 [P] Create empty test files: `apps/api/tests/agents/test_analyst.py`, `apps/api/tests/agents/test_pattern.py`, `apps/api/tests/agents/test_bookkeeper.py`, `apps/api/tests/agents/test_reporter.py` in `apps/api/tests/agents/`

**Checkpoint**: All stub files importable; existing Feature 005/006 tests still pass.

---

## Phase 2: Foundational (Shared Pydantic Output Models)

**Purpose**: All four typed output Pydantic models must exist before any agent can be written or
tested. These live in `packages/shared` (zero external deps) so the dashboard and Telegram bot
can import them without pulling in SQLAlchemy or FastAPI.

**⚠️ CRITICAL**: All user story phases depend on these models.

- [ ] T003 Create `packages/shared/src/finsight/shared/models/assessment.py` with:
  - `ThesisImpact(str, Enum)`: `SUPPORTS = "supports"`, `CONTRADICTS = "contradicts"`, `NEUTRAL = "neutral"`
  - `RiskItem(BaseModel)`: `description: str`, `severity: Literal["low","medium","high"]`
  - `Assessment(BaseModel)`:
    - `significance: str` — explanation of why the event matters
    - `thesis_impact: ThesisImpact`
    - `thesis_rationale: str` — why the impact rating was chosen
    - `risks: list[RiskItem]`
    - `confidence: float` — 0.0–1.0
    - `data_limitations: list[str]` — what was missing or uncertain
  - No `recommendation`, `action`, `buy`, `sell`, or `price_target` fields
  in `packages/shared/src/finsight/shared/models/assessment.py`
- [ ] T004 [P] Create `packages/shared/src/finsight/shared/models/pattern_report.py` with:
  - `PatternType(str, Enum)`: `UPTREND`, `DOWNTREND`, `CONSOLIDATION`, `BREAKOUT`, `REVERSAL`, `ACCUMULATION`, `DISTRIBUTION`, `NO_PATTERN`
  - `PatternObservation(BaseModel)`: `observation: str`, `supporting_data: str`
  - `PatternReport(BaseModel)`:
    - `pattern_type: PatternType`
    - `pattern_name: str | None` — human label (e.g. "Head and Shoulders") or None if NO_PATTERN
    - `confidence: float` — 0.0–1.0
    - `observations: list[PatternObservation]`
    - `timeframe: str` — e.g. "1 month", "3 months"
    - `no_pattern_rationale: str | None` — populated when pattern_type == NO_PATTERN
  - ⚠️ Strictly NO fields named: `recommendation`, `action`, `buy`, `sell`, `price_target`, `target`, `entry`, `exit`
  in `packages/shared/src/finsight/shared/models/pattern_report.py`
- [ ] T005 [P] Create `packages/shared/src/finsight/shared/models/report.py` with:
  - `ReportSection(BaseModel)`: `title: str`, `content: str`
  - `FormattedReport(BaseModel)`:
    - `title: str`
    - `sections: list[ReportSection]`
    - `full_text: str` — concatenated for Telegram delivery (respects 4096 char limit via truncation with note)
    - `ticker: str | None`
    - `mission_id: UUID`
    - `generated_at: datetime`
  in `packages/shared/src/finsight/shared/models/report.py`
- [ ] T006 Update `packages/shared/src/finsight/shared/models/__init__.py` to export: `Assessment`, `ThesisImpact`, `RiskItem`, `PatternReport`, `PatternType`, `PatternObservation`, `FormattedReport`, `ReportSection` in `packages/shared/src/finsight/shared/models/__init__.py`

**Checkpoint**: `from finsight.shared.models import Assessment, PatternReport, FormattedReport` works; `"recommendation" not in PatternReport.model_fields` is True.

---

## Phase 3: User Story 1 — Analyst Produces a Structured Assessment (Priority: P1) 🎯 MVP

**Goal**: `AnalystAgent` makes exactly one LLM call (`with_structured_output(Assessment)`), takes
a `ResearchPacket` as sole input, returns a typed `Assessment`, and records the run via
`AgentRunRepository`. No tool calls allowed.

**Independent Test**: `uv run pytest apps/api/tests/agents/test_analyst.py` — all 3 tests pass offline.

- [ ] T007 [US1] Create `apps/api/src/api/agents/analyst_agent.prompt.py` with:
  - Import `SYSTEM_ROLE_PREAMBLE`, `ANALYSIS_CONSTRAINTS` from `agents/shared/prompts.py`
  - `ANALYST_SYSTEM_PROMPT: str` — instructs the model to: synthesise evidence from the Research Packet, assess thesis support/contradiction, identify risks, explicitly NOT fetch data or make recommendations
  - `def build_user_prompt(packet: ResearchPacket) -> str` — formats ticker, price data, news headlines, KB snippet summaries, data gaps into a structured prompt string
  in `apps/api/src/api/agents/analyst_agent.prompt.py`
- [ ] T008 [US1] Create `apps/api/src/api/agents/analyst_agent.py` with `AnalystAgent(BaseAgent[ResearchPacket, Assessment])`:
  - `name = "analyst"`
  - `output_schema = Assessment`
  - `_build_prompt(self, input: ResearchPacket) -> str` — delegates to `analyst_agent.prompt.build_user_prompt(input)` and returns the full prompt (system + user combined or as messages list)
  - `run(input: ResearchPacket, mission_id: UUID) -> Assessment` — inherited from `BaseAgent`; makes exactly one `with_structured_output(Assessment)` call; no `_call_tool()` invocations
  in `apps/api/src/api/agents/analyst_agent.py`
- [ ] T009 [US1] Write `apps/api/tests/agents/test_analyst.py` (all offline):
  - Fixtures: import `mock_agent_run_repo`, `mock_mcp_client`, `mock_llm_chain`, `pricing_registry`, `agent_configs` from Feature 005 `tests/agents/conftest.py`; create `research_packet_fixture` (valid ResearchPacket with all fields)
  - `test_analyst_returns_assessment` — mock `with_structured_output` returns pre-built `Assessment` instance; assert returned object is `Assessment` with all required fields populated; assert `mock_chain.ainvoke` called exactly once
  - `test_analyst_records_agent_run` — assert `agent_run_repo.create()` called once with `agent_name="analyst"`, `status="complete"`, `cost_usd` matches pricing calculation
  - `test_analyst_handles_conflicting_signals` — provide `ResearchPacket` with positive fundamentals but negative news; mock LLM returns `Assessment(thesis_impact=ThesisImpact.CONTRADICTS, ...)`; assert `thesis_impact == ThesisImpact.CONTRADICTS`
  - Mock pattern: `mock_chain = AsyncMock(return_value=pre_built_assessment)` + `patch.object(ChatOpenAI, "with_structured_output", return_value=mock_chain)`
  in `apps/api/tests/agents/test_analyst.py`

**Checkpoint**: `uv run pytest apps/api/tests/agents/test_analyst.py` — all 3 pass offline.

---

## Phase 4: User Story 2 — Pattern Specialist Identifies Technical Patterns (Priority: P1)

**Goal**: `PatternAgent` makes exactly one LLM call, accepts price/volume history from the
Research Packet, returns `PatternReport` with no investment advice fields, records the run.

**Independent Test**: `uv run pytest apps/api/tests/agents/test_pattern.py` — all 3 tests pass offline.

- [ ] T010 [P] [US2] Create `apps/api/src/api/agents/pattern_agent.prompt.py` with:
  - Import `SYSTEM_ROLE_PREAMBLE`, `ANALYSIS_CONSTRAINTS` from shared prompts
  - `PATTERN_SYSTEM_PROMPT: str` — instructs the model to: identify technical patterns only, describe observations with supporting data, explicitly prohibit any investment advice or price targets, output `NO_PATTERN` if no clear pattern exists
  - `def build_user_prompt(price_history: list, ticker: str) -> str` — formats OHLCV bars into a compact text table for LLM consumption
  in `apps/api/src/api/agents/pattern_agent.prompt.py`
- [ ] T011 [US2] Create `apps/api/src/api/agents/pattern_agent.py` with `PatternAgent(BaseAgent[PatternInput, PatternReport])` where `PatternInput(BaseModel)` has `ticker: str`, `price_history: list[OHLCVBar]`, `mission_id: UUID`:
  - `name = "pattern_specialist"`
  - `output_schema = PatternReport`
  - `_build_prompt(self, input: PatternInput) -> str` — delegates to `pattern_agent.prompt.build_user_prompt(input.price_history, input.ticker)`
  - Raises `AgentOutputError` if `price_history` has fewer than 5 bars (too short to identify patterns) — sets `pattern_type = PatternType.NO_PATTERN` with `no_pattern_rationale = "Insufficient price history"`
  in `apps/api/src/api/agents/pattern_agent.py`
- [ ] T012 [US2] Write `apps/api/tests/agents/test_pattern.py` (all offline):
  - `test_pattern_found` — mock LLM returns `PatternReport(pattern_type=PatternType.UPTREND, confidence=0.8, observations=[...])` with non-empty observations; assert all fields present
  - `test_no_pattern_returned_for_unclear_history` — mock LLM returns `PatternReport(pattern_type=PatternType.NO_PATTERN, no_pattern_rationale="No clear structure")` ; assert `no_pattern_rationale` non-empty
  - `test_pattern_report_has_no_investment_advice_fields` — pure schema inspection: `assert "recommendation" not in PatternReport.model_fields`, `assert "action" not in PatternReport.model_fields`, `assert "buy" not in PatternReport.model_fields`, `assert "sell" not in PatternReport.model_fields`, `assert "price_target" not in PatternReport.model_fields`
  - Mock pattern: same `patch.object(ChatOpenAI, "with_structured_output", return_value=mock_chain)` pattern
  in `apps/api/tests/agents/test_pattern.py`

**Checkpoint**: `uv run pytest apps/api/tests/agents/test_pattern.py` — all 3 pass offline.

---

## Phase 5: User Story 3 — Bookkeeper Writes to the Shared Knowledge Base (Priority: P1)

**Goal**: `BookkeeperAgent` makes NO LLM call; computes SHA-256 content hash; performs a
PostgreSQL-style upsert (`insert.on_conflict_do_update`) to avoid duplicates; flags conflicts
when incoming content diverges significantly from existing entries.

**Independent Test**: `uv run pytest apps/api/tests/agents/test_bookkeeper.py` — all 3 tests pass offline with aiosqlite.

- [ ] T013 [US3] Create `apps/api/src/api/agents/bookkeeper_agent.prompt.py` with module docstring only:
  ```python
  """
  BookkeeperAgent — Sole Knowledge Base Writer

  No LLM call. All logic is deterministic:
  - content_hash = SHA-256(ticker + entry_type + content_summary)
  - Upsert: INSERT ... ON CONFLICT (content_hash) DO UPDATE ...
  - Conflict detection: if existing confidence > 0.7 and incoming confidence > 0.7
    and similarity(existing_summary, incoming_summary) < 0.5 → set conflict_markers
  - Never deletes. Only inserts or updates.
  """
  ```
  in `apps/api/src/api/agents/bookkeeper_agent.prompt.py`
- [ ] T014 [US3] Create `apps/api/src/api/agents/bookkeeper_agent.py` with `BookkeeperAgent`:
  - Does NOT extend `BaseAgent` (no LLM; custom run pattern)
  - `__init__(self, session: AsyncSession, agent_run_repo: AgentRunRepository)`
  - `BookkeeperInput(BaseModel)`: `ticker: str`, `entry_type: str` (e.g., `"analysis"`, `"pattern"`), `content_summary: str`, `source_agent: str`, `mission_id: UUID`, `confidence: float`, `freshness_date: date | None`, `tickers: list[str]`, `tags: list[str]`
  - `async def run(self, input: BookkeeperInput, mission_id: UUID) -> KnowledgeEntryModel`:
    1. Compute `content_hash = hashlib.sha256(f"{input.ticker}:{input.entry_type}:{input.content_summary}".encode()).hexdigest()`
    2. Check existing: `SELECT * FROM knowledge_entries WHERE content_hash = :hash` (or match on `(ticker, entry_type)` as unique constraint)
    3. If existing: check conflict → if both `existing.confidence > 0.7` and `input.confidence > 0.7` and content differs → set `conflict_markers = [f"Conflict with entry {existing.id}: divergent content for {input.ticker}"]`; else no conflict
    4. Upsert via `insert(KnowledgeEntryORM).values(...).on_conflict_do_update(index_elements=["content_hash"], set_={...})` — updates `content`, `confidence`, `freshness_date`, `updated_at`, appends to `conflict_markers`
    5. Record `AgentRunORM` with `cost_usd=Decimal("0.00")`, `tokens_in=0`, `tokens_out=0`, `agent_name="bookkeeper"`, `status="complete"`, `duration_ms`
    6. Return `KnowledgeEntryModel` from the upserted record
  in `apps/api/src/api/agents/bookkeeper_agent.py`
- [ ] T015 [US3] Write `apps/api/tests/agents/test_bookkeeper.py` using `aiosqlite` in-memory engine fixture:
  - Fixtures: `async_engine` (creates `knowledge_entries` table via `Base.metadata.create_all`), `session`, `mock_agent_run_repo`
  - `test_bookkeeper_writes_new_entry` — call `BookkeeperAgent.run(input_fixture)` on empty DB; assert 1 row in `knowledge_entries`; assert `author_agent == "bookkeeper"`; assert `mission_id` matches; assert `content_hash` non-empty
  - `test_bookkeeper_deduplication_upserts_not_duplicates` — call `run()` twice with identical `(ticker, entry_type, content_summary)`; assert exactly 1 row in DB (second call updated the first)
  - `test_bookkeeper_conflict_flagged` — insert existing entry with `confidence=0.8` and content_summary A; call `run()` with `confidence=0.8` and content_summary B (clearly different); assert returned `conflict_markers` is non-empty; assert 1 row (no duplicate created)
  in `apps/api/tests/agents/test_bookkeeper.py`

**Checkpoint**: `uv run pytest apps/api/tests/agents/test_bookkeeper.py` — all 3 pass offline with aiosqlite.

---

## Phase 6: User Story 4 — Reporter Formats Agent Outputs for Delivery (Priority: P2)

**Goal**: `ReporterAgent` makes exactly one LLM call, receives `Assessment` + `PatternReport` +
optional summary text, returns `FormattedReport` with human-readable sections. No new analysis added.

**Independent Test**: `uv run pytest apps/api/tests/agents/test_reporter.py` — all 2 tests pass offline.

- [ ] T016 [P] [US4] Create `apps/api/src/api/agents/reporter_agent.prompt.py` with:
  - Import `SYSTEM_ROLE_PREAMBLE` from shared prompts
  - `REPORTER_SYSTEM_PROMPT: str` — instructs model to: format provided content into sections, use plain language, explicitly NOT add new analysis or conclusions, produce a `full_text` under 4096 chars for Telegram
  - `def build_user_prompt(assessment: Assessment, pattern_report: PatternReport, ticker: str, mission_id: UUID) -> str` — serialises inputs as structured text for LLM
  in `apps/api/src/api/agents/reporter_agent.prompt.py`
- [ ] T017 [US4] Create `apps/api/src/api/agents/reporter_agent.py` with `ReporterAgent(BaseAgent[ReporterInput, FormattedReport])` where `ReporterInput(BaseModel)` has `assessment: Assessment`, `pattern_report: PatternReport`, `ticker: str`, `mission_id: UUID`:
  - `name = "reporter"`
  - `output_schema = FormattedReport`
  - `_build_prompt(self, input: ReporterInput) -> str` — delegates to `reporter_agent.prompt.build_user_prompt(...)`
  - Inherited `run()` from BaseAgent; single `with_structured_output(FormattedReport)` call
  in `apps/api/src/api/agents/reporter_agent.py`
- [ ] T018 [US4] Write `apps/api/tests/agents/test_reporter.py` (all offline):
  - `test_reporter_formats_all_key_points` — provide `Assessment` with 2 risks and `PatternReport` with 1 observation; mock LLM returns `FormattedReport` with sections; assert `full_text` non-empty, `len(full_text) <= 4096`, `title` non-empty, `sections` non-empty
  - `test_reporter_adds_no_new_analysis` — inspect `FormattedReport` schema: assert no fields named `recommendation`, `analysis`, `conclusion`, `opinion`, `action` exist in `FormattedReport.model_fields`; additionally assert the mock LLM's output instance contains only formatted text (no new reasoning added beyond what the prompt instructed)
  - Mock pattern: same `patch.object(ChatOpenAI, "with_structured_output", return_value=mock_chain)` pattern
  in `apps/api/tests/agents/test_reporter.py`

**Checkpoint**: `uv run pytest apps/api/tests/agents/test_reporter.py` — both tests pass offline.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T019 [P] Run `uv run mypy --strict packages/shared/src/finsight/shared/models/assessment.py packages/shared/src/finsight/shared/models/pattern_report.py packages/shared/src/finsight/shared/models/report.py apps/api/src/api/agents/analyst_agent.py apps/api/src/api/agents/pattern_agent.py apps/api/src/api/agents/bookkeeper_agent.py apps/api/src/api/agents/reporter_agent.py` — fix all type errors until zero errors remain
- [ ] T020 [P] Run `uv run ruff check` on all new files — fix all warnings
- [ ] T021 Run full test suite: `uv run pytest apps/api/tests/agents/` — all 11 tests across 4 test files pass offline; no network calls; no Docker

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001 and T002 parallel
- **Foundational (Phase 2)**: Depends on Phase 1; T003 → [T004, T005] parallel → T006
- **US1 (Phase 3)**: Depends on Phase 2 (Assessment model); T007 → T008 → T009
- **US2 (Phase 4)**: Depends on T004 (PatternReport model); T010 → T011 → T012 (parallel with US1 after Phase 2)
- **US3 (Phase 5)**: Depends on Phase 2 (shared models for BookkeeperInput); also depends on Feature 002 KnowledgeEntryORM; T013 → T014 → T015 (parallel with US1+US2 after Phase 2)
- **US4 (Phase 6)**: Depends on T003 (Assessment) and T004 (PatternReport) and T005 (FormattedReport); T016 → T017 → T018 (parallel with US1+US2+US3 after Phase 2)
- **Polish (Phase 7)**: Depends on all phases; T019 and T020 parallel → T021

### User Story Dependencies

- **US1, US2, US3, US4**: All depend only on Phase 2 (shared models); all four can be implemented fully in parallel after Phase 2 completes

### Parallel Execution Map

```
Phase 1: [T001, T002] parallel
Phase 2: T003 → [T004, T005] parallel → T006
Phase 3+4+5+6: All four agents fully parallel after Phase 2:
  US1: T007 → T008 → T009
  US2: T010 → T011 → T012
  US3: T013 → T014 → T015
  US4: T016 → T017 → T018
Phase 7: [T019, T020] → T021
```

---

## Parallel Example: Four Agents in Four Workstreams

```
# After Phase 2 (shared models ready):
Workstream A (US1 Analyst):          T007 → T008 → T009
Workstream B (US2 Pattern):          T010 → T011 → T012
Workstream C (US3 Bookkeeper):       T013 → T014 → T015
Workstream D (US4 Reporter):         T016 → T017 → T018
```

---

## Implementation Strategy

### MVP First (User Story 1 — Analyst)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (all shared models)
3. Complete Phase 3: US1 (AnalystAgent + 3 tests)
4. **STOP and VALIDATE**: `uv run pytest apps/api/tests/agents/test_analyst.py` — all pass
5. Core reasoning engine working — Feature 008 Manager can route to Analyst

### Incremental Delivery

1. Setup + Foundational → shared models ready for all agents
2. US1 → Analyst tested → investigation assessments available
3. US2 → Pattern Specialist → technical dimension added
4. US3 → Bookkeeper → knowledge accumulated across runs
5. US4 → Reporter → formatted summaries ready for Telegram (Feature 009) and Dashboard (Feature 010)

---

## Notes

- Tests are **required** by spec (FR-010: all four agents testable offline)
- **Critical mock pattern** (do not deviate): `mock_chain = AsyncMock(return_value=pre_built_pydantic_instance)` + `with patch.object(ChatOpenAI, "with_structured_output", return_value=mock_chain)` — patching `ChatOpenAI.ainvoke` directly will NOT work because `with_structured_output` returns a `RunnableSequence`
- Assert `mock_chain.ainvoke.call_count == 1` not `mock_chain.call_count` — the chain is called via `.ainvoke()`, not directly
- `BookkeeperAgent` has NO LLM call — does not extend `BaseAgent`; implements its own AgentRun recording directly; `cost_usd = Decimal("0.00")` always
- `PatternReport` no-advice check is a schema-level test (`model_fields` inspection) — no LLM needed for this test
- `content_hash` unique constraint enables the `ON CONFLICT DO UPDATE` upsert — this constraint must exist in the `knowledge_entries` table from Feature 002's migration (add if not already there via a note in the migration comments)
- `KnowledgeEntryModel` (Pydantic domain model in `packages/shared`) is separate from `KnowledgeEntryORM` (SQLAlchemy in `apps/api`) — Bookkeeper converts ORM → domain model for return value
- `aiosqlite` does not support `ON CONFLICT DO UPDATE` with PostgreSQL dialect — use `merge()` or standard `upsert` pattern that is SQLite-compatible in tests (check if existing row, update or insert)
- `FormattedReport.full_text` should be truncated at 4096 chars with a trailing `"\n[Truncated]"` note if the LLM produces longer text — this is Telegram's message limit
