# Implementation Plan: Reasoning Agents

**Branch**: `007-reasoning-agents` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Implement four reasoning agents — Analyst, Technician (Pattern Specialist), Bookkeeper/Librarian, and Reporter — that operate on pre-assembled research packets and produce typed Pydantic output models. Each agent makes at most one LLM call (none for the Bookkeeper), respects strict boundary rules (no data fetching, no advice, sole KB writer), and records every run via the `AgentRun` cost-tracking infrastructure from Feature 005.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: `langchain-openai>=0.3`, `langchain-core>=0.3`, `sqlalchemy[asyncio]>=2.0`, `aiosqlite>=0.20`, `pydantic>=2.7`, `pytest>=8.0`, `pytest-asyncio>=0.23`, `respx>=0.21`
**Storage**: PostgreSQL 16 + pgvector (`knowledge_entries` table introduced by Feature 007 migration; embedding column nullable)
**Testing**: pytest + pytest-asyncio + unittest.mock.AsyncMock; offline (no network, no Docker)
**Target Platform**: Linux server (Docker) / Windows 11 dev (Podman)
**Project Type**: Python monorepo sub-packages (`packages/shared`, `apps/api-service`)
**Performance Goals**: Analyst < 60 s, Technician (Pattern Specialist) < 30 s, Bookkeeper write < 5 s, Reporter < 10 s
**Constraints**: mypy --strict zero errors; ruff zero warnings; all tests offline; PatternReport schema must not contain recommendation/action/price_target fields
**Scale/Scope**: Single-operator personal tool; 4 agents; ~15 source files + 4 test files

## Constitution Check

- [x] Everything-as-Code — agent model names, thresholds, and prompt toggles live in `config/runtime/agents.yaml`; no hardcoded model strings in Python
- [x] Agent Boundaries — Analyst: interprets only (no fetch). Technician (Pattern Specialist): technical only (no advice). Bookkeeper: sole KB writer. Reporter: formats only (no analysis). Each boundary enforced by schema design and prompt instruction.
- [x] MCP Server Independence — N/A; reasoning agents do not call MCP tool servers
- [x] Cost Observability — reasoning agents using LLM inherit `BaseAgent.run()` (Feature 005), which persists AgentRun with tokens/cost metadata
- [x] Fail-Safe Defaults — invalid `agents.yaml` triggers `sys.exit(1)` at startup; LLM parse failure retried once; second failure marks mission FAILED
- [x] Test-First — all 11 test cases are offline; Bookkeeper tests use aiosqlite in-memory
- [x] Simplicity Over Cleverness — single LLM call per reasoning agent via `with_structured_output`; no internal graph for single-step agents; Bookkeeper has no LLM call at all

## Project Structure

### Documentation (this feature)

```text
specs/007-reasoning-agents/
├── plan.md              # This file
├── research.md          # Technology decisions
├── data-model.md        # Pydantic + ORM schemas
├── quickstart.md        # How to run and test
└── checklists/          # Existing checklist files
```

### Source Code

```text
packages/shared/src/finsight/shared/models/
├── assessment.py         # ThesisImpact enum + Assessment Pydantic model
├── pattern_report.py     # PatternType enum + PatternObservation + PatternReport Pydantic model
├── knowledge_entry.py    # ProvenanceRecord + KnowledgeEntry Pydantic schema
└── report.py             # ReportSection + FormattedReport Pydantic model

apps/api-service/src/api/agents/
├── analyst_agent.py      # AnalystAgent: accepts ResearchPacket, returns Assessment, one LLM call
├── analyst_agent.prompt.py  # SYSTEM_PROMPT + build_user_prompt(packet: ResearchPacket) -> str
├── pattern_agent.py      # PatternAgent: accepts price/volume history, returns PatternReport
├── pattern_agent.prompt.py  # SYSTEM_PROMPT + build_user_prompt(history: PriceHistory) -> str
├── bookkeeper_agent.py   # BookkeeperAgent: no LLM call; writes/updates KnowledgeEntry in DB
├── bookkeeper_agent.prompt.py  # No LLM; file contains content_hash helper and dedup logic docs
├── reporter_agent.py     # ReporterAgent: accepts Assessment+PatternReport, returns FormattedReport
└── reporter_agent.prompt.py   # SYSTEM_PROMPT + build_user_prompt(...) -> str

apps/api-service/src/api/db/models/
└── knowledge_entry.py   # SQLAlchemy ORM model for curated KB entries (introduced in 007)

apps/api-service/alembic/versions/
└── <new 007 migration>.py  # creates knowledge_entries (+ indexes/constraints)

apps/api-service/tests/agents/
├── test_analyst.py       # 3 test cases: assessment, conflicting signals, no signal
├── test_pattern.py       # 3 test cases: pattern found, no pattern, no investment advice
├── test_bookkeeper.py    # 3 test cases: write entry, deduplication, conflict flagging
└── test_reporter.py      # 2 test cases: formats output, adds no new analysis
```

## Implementation Phases

### Phase 1: Shared Pydantic Models

**Files**:
- `packages/shared/src/finsight/shared/models/assessment.py` — `ThesisImpact` enum, `Assessment` Pydantic v2 BaseModel
- `packages/shared/src/finsight/shared/models/pattern_report.py` — `PatternType` enum, `PatternObservation`, `PatternReport`
- `packages/shared/src/finsight/shared/models/knowledge_entry.py` — `ProvenanceRecord`, `KnowledgeEntry` Pydantic schema
- `packages/shared/src/finsight/shared/models/report.py` — `ReportSection`, `FormattedReport`

**Key decisions**:
- All enums use `str` mixin for JSON serialisation without extra config
- `PatternReport` enforces no advice at the schema level: no `recommendation`, `action`, `buy`, `sell`, or `price_target` fields exist
- `KnowledgeEntry` Pydantic schema is separate from the ORM model to keep `packages/shared` free of SQLAlchemy imports

### Phase 2: ORM Model Reference

**Files**:
- `apps/api-service/src/api/db/models/knowledge_entry.py` — `KnowledgeEntryORM`
- `apps/api-service/alembic/versions/<new_007_migration>.py` — migration creating `knowledge_entries`

**Key decisions**:
- `knowledge_entries` is introduced in 007 to match Bookkeeper ownership of KB writes.
- Include unique dedup key and indexes required by Bookkeeper upsert logic.
- Keep embedding nullable for phased rollout (writing curated entries first, embedding later).

### Phase 3: Agent Implementations

**Files**:
- `apps/api-service/src/api/agents/analyst_agent.py` + `analyst_agent.prompt.py`
- `apps/api-service/src/api/agents/pattern_agent.py` + `pattern_agent.prompt.py`
- `apps/api-service/src/api/agents/bookkeeper_agent.py` + `bookkeeper_agent.prompt.py`
- `apps/api-service/src/api/agents/reporter_agent.py` + `reporter_agent.prompt.py`

**Key decisions**:
- `AnalystAgent.run(packet: ResearchPacket, mission_id: UUID) -> Assessment`: inherits `BaseAgent.run()` and performs one `with_structured_output(Assessment)` call
- `PatternAgent.run(history: PriceHistory, mission_id: UUID) -> PatternReport`: same pattern; prompt explicitly prohibits investment language
- `BookkeeperAgent.run(inputs: BookkeeperInput, mission_id: UUID) -> KnowledgeEntry`: no LLM call; computes SHA-256 `content_hash`; uses SQLAlchemy `insert(...).on_conflict_do_update` (PostgreSQL upsert); detects conflicts by comparing incoming `confidence` and `content_summary` against existing
- `ReporterAgent.run(inputs: ReporterInput, mission_id: UUID) -> FormattedReport`: single LLM call formats Assessment + PatternReport into titled sections; system prompt prohibits adding new analysis

### Phase 4: Tests

**Files**:
- `apps/api-service/tests/agents/test_analyst.py`
- `apps/api-service/tests/agents/test_pattern.py`
- `apps/api-service/tests/agents/test_bookkeeper.py`
- `apps/api-service/tests/agents/test_reporter.py`

**Key decisions**:
- LLM calls mocked via `patch.object(ChatOpenAI, "with_structured_output", ...)` — see Testing Strategy for the correct pattern
- Bookkeeper tests use `pytest-asyncio` with an `aiosqlite` in-memory async engine fixture; migrations applied via `Base.metadata.create_all`
- `test_pattern_report_has_no_investment_advice` inspects `PatternReport.model_fields` keys to assert forbidden field names are absent

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Single LLM call per reasoning agent | `model.with_structured_output(Pydantic)` | Simplest path to typed output; no tool routing needed |
| Bookkeeper has no LLM call | Pure Python SHA-256 + SQL upsert | KB writes must be deterministic and fast (< 5 s); LLM adds latency and cost without benefit |
| PatternReport schema enforces no-advice at field level | No advice-related fields exist | Schema is the contract; cannot be circumvented at runtime |
| Provenance stored as JSONB list | Append-only list in JSONB column | Avoids separate `provenance_records` join table; sufficient for single-operator scale |
| Shared models in `packages/shared` | Zero external deps in shared package | Telegram bot and dashboard can import models without pulling in FastAPI or SQLAlchemy |

## Testing Strategy

All tests run entirely offline:

- **Analyst / Pattern / Reporter**: `llm.with_structured_output(Schema)` returns a `RunnableSequence`,
  not the base `ChatOpenAI` — patching `ChatOpenAI.ainvoke` directly will not intercept the call.
  Correct mock pattern:
  ```python
  mock_chain = AsyncMock(return_value=pre_built_pydantic_instance)
  with patch.object(ChatOpenAI, "with_structured_output", return_value=mock_chain):
      result = await agent.run(input_fixture)
  ```
  Tests assert output field values and that `mock_chain.ainvoke` was called exactly once.
- **Bookkeeper**: `aiosqlite` in-memory engine with `Base.metadata.create_all(engine)`. Test inserts an entry, inserts again with same hash, asserts single row. Conflict test inserts two entries with divergent `content_summary` for same `(ticker, entry_type)` and asserts `conflict_markers` is non-empty.
- **PatternReport no-advice test**: `assert "recommendation" not in PatternReport.model_fields` — pure schema inspection, no LLM needed.

## Dependencies

- **Requires**: Feature 002 (async data layer — AsyncSession, Base), Feature 005 (agent infrastructure — BaseAgent ABC, AgentRun ORM, agents.yaml config), Feature 006 (ResearchPacket model and sub-models)
- **Required by**: Feature 008 (Orchestration — Manager invokes these agents), Feature 010 (Dashboard — displays KnowledgeEntry and FormattedReport)
