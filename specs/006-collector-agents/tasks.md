# Tasks: Collector Agents

**Input**: Design documents from `/specs/006-collector-agents/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | research.md ✅ | quickstart.md ✅
**Total Tasks**: 19

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])

---

## Phase 0: Prerequisite Verification

- [X] T000 Verify Feature 002 artifacts exist in current branch: `WatchlistItem`, `Alert`, `Mission`, `AgentRun` ORM models and repositories under `apps/api-service/src/api/db/{models,repositories}/`. If missing, add minimal compatible implementations required by 006 and continue.

---

## Phase 1: Setup

- [X] T001 Create test modules:
  - `apps/api-service/tests/agents/test_watchdog.py`
  - `apps/api-service/tests/agents/test_researcher.py`
- [X] T002 [P] Create shared model module:
  - `packages/shared/src/finsight/shared/models/research_packet.py`

---

## Phase 2: Foundation (Config + Shared Types)

- [X] T003 Update `config/runtime/watchdog.yaml`:
  - keep existing keys (`poll_interval_seconds`, `alert_cooldown_seconds`, `default_thresholds.*`)
  - add `news_spike_rate_per_hour: 5`
  - add `news_fetch_limit: 100`
  - add `dedup_window_hours: 4`
- [X] T004 Update `config/schemas/watchdog.py` to include:
  - `news_spike_rate_per_hour: int = 5`
  - `news_fetch_limit: int = 100`
  - `dedup_window_hours: int = 4`
- [X] T004a Add Researcher fetch config:
  - `config/runtime/researcher.yaml` with `ohlcv_period`, `news_limit`, `kb_limit`
  - `config/schemas/researcher.py` with typed validation for those fields
- [X] T005 Implement `research_packet.py` with:
  - `OHLCVBar`, `FundamentalsSnapshot`, `NewsItem`, `KnowledgeSnippet`
  - `ResearchPacket` (`ticker`, `mission_id`, `price_history`, `fundamentals`, `news_items`, `kb_entries`, `data_gaps`)
- [X] T006 [P] Export new models from `packages/shared/src/finsight/shared/models/__init__.py`.
- [X] T007 [P] Create or update `apps/api-service/src/api/db/repositories/alert.py` with:
  - `AlertRepository.get_recent(ticker: str, condition_type: str, window_hours: int) -> list[AlertORM]`

---

## Phase 3: US1 Watchdog (P1)

- [X] T008 [US1] Create `apps/api-service/src/api/agents/watchdog_agent.prompt.py` as module-level docstring only (deterministic evaluator, no LLM prompt).
- [X] T009 [US1] Implement `apps/api-service/src/api/agents/watchdog_agent.py`:
  - `WatchdogAgent` (no BaseAgent inheritance)
  - threshold checks for price/volume/news
  - per-item threshold override over YAML defaults
  - dedup via `AlertRepository.get_recent(...)`
  - create `Alert` + `Mission` on breach
  - record `AgentRun` with `status="completed"` and zero tokens/cost
  - `_call_tool(...)` wrapper catches `MCPToolError`
  - `WatchdogResult` model (`alerts_created`, `missions_opened`, `items_evaluated`, `dedup_skipped`)
- [X] T010 [US1] Implement `apps/api-service/tests/agents/test_watchdog.py`:
  - breach creates alert+mission
  - no breach creates nothing
  - dedup suppresses duplicate
  - multiple items evaluated independently
  - per-item threshold overrides YAML default
  - MCP failure is handled gracefully

---

## Phase 4: US2 Researcher (P1)

- [X] T011 [P] [US2] Create `apps/api-service/src/api/agents/researcher_agent.prompt.py` charter doc (collector-only, no interpretation).
- [X] T012 [US2] Implement `apps/api-service/src/api/agents/researcher_agent.py`:
  - `ResearchInput(ticker, mission_id)`
  - concurrent MCP calls (`market.get_ohlcv`, `market.get_fundamentals`, `news.get_news`, `knowledge.search_knowledge`)
  - build `ResearchPacket`
  - record missing sections in `data_gaps`
  - record `AgentRun` with `status="completed"` and zero tokens/cost
  - `_call_tool(...)` wrapper catches `MCPToolError`
- [X] T013 [US2] Implement `apps/api-service/tests/agents/test_researcher.py`:
  - tool call coverage and call names
  - successful packet assembly
  - absent data recorded in `data_gaps`
  - no analytical fields in output schema
  - partial tool failure still returns packet
  - agent run recorded with zero cost

---

## Phase 5: US3 Watchdog News Spike (P2)

- [X] T014 [US3] Extend `watchdog_agent.py`:
  - `_evaluate_news_volume(...)`
  - `_assess_severity(ratio: float)` mapping
  - integrate news-spike path with dedup and alert creation
- [X] T015 [US3] Extend `test_watchdog.py`:
  - news spike creates alert
  - normal news volume does not alert
  - high spike maps to critical severity

---

## Phase 6: Polish

- [X] T016 [P] Run mypy strict:
  - `uv run mypy --strict apps/api-service/src/api/agents/watchdog_agent.py apps/api-service/src/api/agents/researcher_agent.py packages/shared/src/finsight/shared/models/research_packet.py`
- [X] T017 [P] Run ruff:
  - `uv run ruff check apps/api-service/src/api/agents/watchdog_agent.py apps/api-service/src/api/agents/researcher_agent.py packages/shared/src/finsight/shared/models/research_packet.py`
- [X] T018 Run tests:
  - `uv run pytest apps/api-service/tests/agents/test_watchdog.py apps/api-service/tests/agents/test_researcher.py`
  - all tests offline, no real network.

---

## Notes

- Collector agents are deterministic and do not call LLMs in 006.
- 006 consumes 002 entities when available; if missing, it includes minimal compatible
  ORM/repository implementations required for collector-agent execution.
- Agent observability remains mandatory via AgentRun records (zero-token runs for collectors).
