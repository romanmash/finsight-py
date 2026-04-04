# Tasks: Orchestration (008)

**Feature**: 008-orchestration
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Total Tasks**: 32
**Generated**: 2026-04-03

## Notes for Implementors

- **Celery + asyncio bridge**: All agent `run()` calls are `async def`. Celery tasks are sync.
  Use `asyncio.run(_run_pipeline_async(...))` inside every Celery task function. Do NOT use
  `celery[gevent]` — gevent monkey-patching is incompatible with asyncio.
- **Worker pool**: Use `--pool=prefork` (default). Each Celery worker process calls
  `asyncio.run()` independently — this is safe.
- **Checkpointer**: `PostgresSaver` in production (requires DB URL). `SqliteSaver(":memory:")`
  in tests — no PostgreSQL needed offline.
- **LLM mock pattern** (same as Features 005–007):
  `patch.object(ChatOpenAI, "with_structured_output", return_value=AsyncMock(return_value=instance))`
  Do NOT patch `ainvoke` directly.
- **Alert poll**: use an AlertRepository query for unprocessed alerts based on current schema:
  `mission_id IS NULL AND deleted_at IS NULL`, ordered ASC by `created_at`.
- **Cross-package Celery dispatch**: `mission_worker` dispatches to the telegram queue via
  `celery_app.send_task("telegram_bot.notifier.deliver_to_telegram", ...)` — string reference
  only, no import of the telegram-bot package.
- **docker-compose.yml extension**: Feature 001 created the stub. This feature adds 4 containers:
  `celery-beat`, `worker-mission`, `worker-alert`, `worker-screener`. Existing `worker-watchdog`
  and `worker-brief` entries remain unchanged.

---

## Phase 1: Setup

- [X] T001 Create `apps/api-service/src/api/graphs/__init__.py` with empty module stub
- [X] T002 Create `apps/api-service/src/api/workers/__init__.py` with empty module stub
- [X] T003 [P] Create test directory `apps/api-service/tests/orchestration/` with empty `__init__.py`
- [X] T004 [P] Add langgraph, langgraph-checkpoint-postgres deps to `apps/api-service/pyproject.toml` under `[project.dependencies]`

---

## Phase 2: Foundational

- [X] T005 Create `config/runtime/scheduler.yaml` with three pipeline definitions (investigation: [researcher, analyst, technician, bookkeeper, reporter]; daily_brief: [researcher, analyst, reporter] cron "0 7 * * MON-FRI"; screener_scan: [researcher, watchdog]) and `alert_poll_interval_seconds: 30`
- [X] T006 Create `config/schemas/scheduler.py` with `PipelineConfig(name, agent_sequence, cron, max_retries=1, retry_backoff_seconds=5)` and pipeline-based `SchedulerConfig`, plus a backward-compatible migration path from current `screener_cron`/`brief_cron` runtime shape; ensure `AllConfigs.scheduler` loading in `apps/api-service/src/api/lib/config.py` remains valid
- [X] T007 Create `apps/api-service/src/api/lib/queues.py` with `Celery("finsight", broker=settings.redis_url, backend=settings.redis_url)`, beat schedule built from `scheduler.yaml` pipeline cron entries at startup (not hardcoded), and `task_always_eager=True` when `CELERY_TASK_ALWAYS_EAGER=true` env var is set
- [X] T008 Extend `docker-compose.yml` (root level) to add four new containers: `celery-beat` (command: `celery -A api.lib.queues beat -l info`), `worker-mission` (queue: mission), `worker-alert` (queue: alert), `worker-screener` (queue: screener) — all using same image as `api`; preserve existing `worker-watchdog` and `worker-brief` entries
- [X] T009 Create `apps/api-service/tests/orchestration/conftest.py` with: `CELERY_TASK_ALWAYS_EAGER=true` env fixture, `SqliteSaver(":memory:")` checkpointer fixture, mock `MissionRepository` fixture, mock `AlertRepository` fixture returning empty list, `AsyncMock` fixtures for all 9 agents

---

## Phase 3: User Story 1 — Operator Query Routing

**Goal**: Manager agent classifies operator query and routes to correct pipeline via LangGraph supervisor.

**Independent test**: `POST /missions {"query": "analyze AAPL"}` → mission created with status `pending` → Celery task runs → manager classifies as "investigation" → graph routes through investigation pipeline nodes → mission status `completed`.

- [X] T010 [US1] Create `apps/api-service/src/api/agents/manager_agent.prompt.py` with `MANAGER_SYSTEM_PROMPT` (intent classification only — extract pipeline_type and ticker; NEVER analyze content) and `build_manager_prompt(query: str) -> str`
- [X] T011 [US1] Create `apps/api-service/src/api/agents/manager_agent.py` with `PipelineClassification(pipeline_type: Literal["investigation","daily_brief","screener_scan","unknown"], ticker: str | None, confidence: float)` and `ManagerInput(BaseModel)` containing `query: str`; implement `ManagerAgent(BaseAgent[ManagerInput, PipelineClassification])` using `with_structured_output(PipelineClassification)`; single LLM call; no content analysis
- [X] T012 [P] [US1] Create `apps/api-service/src/api/graphs/state.py` with `GraphState(TypedDict)` containing: `mission_id: UUID`, `pipeline_type: str`, `ticker: str | None`, `research_packet: ResearchPacket | None`, `assessment: Assessment | None`, `pattern_report: PatternReport | None`, `formatted_report: FormattedReport | None`, `error: str | None`, `completed_nodes: list[str]`
- [X] T013 [US1] Create `apps/api-service/src/api/graphs/nodes.py` with async node wrapper functions for each agent step: `researcher_node`, `analyst_node`, `pattern_node`, `bookkeeper_node`, `reporter_node`, `watchdog_node` — each reads `GraphState`, calls the corresponding agent's `run()`, updates state fields, appends node name to `completed_nodes`
- [X] T014 [US1] Create `apps/api-service/src/api/graphs/supervisor.py` with `build_supervisor_graph(checkpointer) -> CompiledGraph`: `StateGraph(GraphState)`, add supervisor node calling `ManagerAgent`, `add_conditional_edges` routing from supervisor to agent nodes or END based on `PipelineClassification.pipeline_type` and `completed_nodes`; `compile(checkpointer=checkpointer)`
- [X] T015 [US1] Create `apps/api-service/src/api/routes/missions.py` with: `POST /missions` (create mission using repository payload shape `mission_type`, `source`, `status="pending"`, `query`, `ticker`; dispatch `mission_worker.delay(str(mission_id))`; return mission_id), `GET /missions/{id}` (return mission + all AgentRun records), `GET /missions` (paginated, filterable by status); all routes require auth via `require_role("admin","viewer")`
- [X] T016 [US1] Create `apps/api-service/tests/orchestration/test_manager.py` with 3 tests: (1) investigation intent classified from stock query, (2) daily_brief intent classified from "morning brief" query, (3) unknown intent returns confidence < 0.5 — all using correct `with_structured_output` mock pattern
- [X] T017 [US1] Create `apps/api-service/tests/orchestration/test_supervisor.py` with 2 tests: (1) investigation pipeline routes through all 5 nodes in correct order using `SqliteSaver(":memory:")`, (2) daily_brief routes through 3 nodes — agents mocked with AsyncMock

---

## Phase 4: User Story 2 — Alert-Triggered Mission

**Goal**: `alert_worker` polls unprocessed alerts and auto-creates + dispatches missions.

**Independent test**: seed Alert with `mission_id=null` → `alert_worker.delay()` with always_eager → Mission created with status `pending` → `mission_worker.delay()` called → alert `mission_id` updated to created mission id.

- [X] T018 [US2] Create `apps/api-service/src/api/workers/alert_worker.py` with `@celery_app.task` `run_alert_poll()`: calls `asyncio.run(_poll_alerts_async())`; async inner function queries unprocessed alerts (`mission_id IS NULL AND deleted_at IS NULL`), creates mission using current repository contract (`mission_type`, `source`, `status="pending"`, `query`, `ticker`), dispatches `mission_worker.delay(str(mission_id))`, then updates alert `mission_id` to the created mission id
- [X] T019 [US2] Create `apps/api-service/tests/orchestration/test_alert_worker.py` with 3 tests: (1) unprocessed alert → mission created and dispatched, (2) alert already linked to mission → no new mission, (3) empty alert list → no-op

---

## Phase 5: User Story 3 — Scheduled Daily Brief

**Goal**: Celery beat triggers daily brief pipeline at configured cron schedule.

**Independent test**: `brief_worker.delay()` with always_eager → `daily_brief` pipeline executes → `FormattedReport` produced → mission status `completed`.

- [X] T020 [US3] Create `apps/api-service/src/api/workers/brief_worker.py` with `@celery_app.task` `run_daily_brief()`: calls `asyncio.run(_run_brief_async())`; creates mission via current repository contract (`mission_type="daily_brief"`, `source="schedule"`, `status="pending"`, `query`, `ticker=None`), dispatches `mission_worker.delay(str(mission_id))`
- [X] T021 [P] [US3] Create `apps/api-service/src/api/workers/screener_worker.py` with `@celery_app.task` `run_screener_scan()`: calls `asyncio.run(_run_screener_async())`; iterates tickers from config watchlist, dispatches one `mission_worker.delay()` per ticker after mission creation using current repository contract (`mission_type="screener_scan"`, `source="schedule"`, `status="pending"`, `query`, `ticker`)

---

## Phase 6: User Story 4 — State Persistence Across Restarts

**Goal**: `mission_worker` uses LangGraph checkpointer so interrupted pipelines can resume.

**Independent test**: Simulate mid-pipeline interruption via SqliteSaver checkpoint → re-run graph with same `thread_id` → resumes from `completed_nodes` checkpoint → completes without re-running finished nodes.

- [X] T022 [US4] Create `apps/api-service/src/api/workers/mission_worker.py` with `@celery_app.task(bind=True, max_retries=1)` `run_mission_pipeline(self, mission_id: str)`: calls `asyncio.run(_run_pipeline_async(UUID(mission_id)))`; async inner builds graph via `build_supervisor_graph(checkpointer)` with `PostgresSaver` (prod) or `SqliteSaver(":memory:")` (test via env flag), sets mission status `running` on start, `completed` on finish, `failed` on unrecoverable error; dispatches `celery_app.send_task("telegram_bot.notifier.deliver_to_telegram", args=[mission_id, formatted_report])` (or serialized report payload) on completion
- [X] T023 [US4] Create `apps/api-service/src/api/workers/watchdog_worker.py` with `@celery_app.task` `run_watchdog_scan()`: calls `asyncio.run(_run_watchdog_async())`; iterates watchlist tickers from config, calls `WatchdogAgent.run()` per ticker
- [X] T024 [US4] Create `apps/api-service/tests/orchestration/test_mission_worker.py` with 3 tests: (1) full pipeline pending→running→completed status transitions with all agents mocked, (2) agent failure → running→failed + retry attempted, (3) checkpoint resume: second `run_mission_pipeline` call with same mission_id resumes from checkpoint (verify node not called twice)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T025 Register `missions` router in `apps/api-service/src/api/main.py` under prefix `/missions`
- [X] T026 Export `GraphState`, `build_supervisor_graph` from `apps/api-service/src/api/graphs/__init__.py`
- [X] T027 Export all Celery task functions from `apps/api-service/src/api/workers/__init__.py`
- [X] T028 Add `CELERY_TASK_ALWAYS_EAGER` to `.env.example` with value `false` and comment `# Set to true in test environments only`
- [X] T029 Add `LANGGRAPH_CHECKPOINT_DB_URL` to `.env.example` with placeholder and comment `# PostgreSQL DSN for LangGraph checkpointer (defaults to DATABASE_URL if unset)`
- [X] T030 Run `uv run mypy --strict apps/api-service/src/api/graphs/ apps/api-service/src/api/workers/ apps/api-service/src/api/agents/manager_agent.py apps/api-service/src/api/routes/missions.py` — zero errors required
- [X] T031 Run `uv run ruff check apps/api-service/src/api/graphs/ apps/api-service/src/api/workers/ apps/api-service/src/api/routes/missions.py` — zero warnings required
- [X] T032 Run `uv run pytest apps/api-service/tests/orchestration/ -v` — all tests must pass offline without Docker or Redis broker

---

## Dependency Graph

```
Phase 1 (T001–T004) → Phase 2 (T005–T009) → Phase 3 US1 (T010–T017)
                                           → Phase 4 US2 (T018–T019)  [after Phase 3]
                                           → Phase 5 US3 (T020–T021)  [after Phase 2]
                                           → Phase 6 US4 (T022–T024)  [after Phase 3]
Phase 3 + Phase 4 + Phase 5 + Phase 6 → Phase 7 (T025–T032)
```

**External dependencies (must be complete before starting this feature)**:
- Feature 002: `MissionRepository`, `AlertRepository`, ORM models
- Feature 003: `require_role()` dependency, `main.py` router registration pattern
- Feature 005: `BaseAgent[InputT, OutputT]`
- Feature 006: `WatchdogAgent`, `ResearcherAgent`, `ResearchPacket`
- Feature 007: `AnalystAgent`, `PatternAgent`, `BookkeeperAgent`, `ReporterAgent`

---

## Parallel Execution Opportunities

Within Phase 3 (US1), after T011 and T012 complete:
- T013 (nodes.py) and T016 (test_manager.py) can run in parallel
- T014 (supervisor.py) depends on T013

Within Phase 2:
- T003 (test dir) and T004 (pyproject deps) can run in parallel with each other

Phases 4 (US2), 5 (US3) are independent of each other and can run in parallel after Phase 2.

---

## Implementation Strategy

**MVP scope** (US1 + US2): Implement T001–T019. This delivers operator query → mission pipeline + alert auto-triggering — the two P1 stories. US3 (scheduled brief) and US4 (checkpoint resume) are P2 and can follow.

**Incremental delivery**:
1. T001–T009: Config + Celery app wired up, tests can verify scheduler.yaml loads
2. T010–T017: Manager + graph routing working end-to-end with mocked agents
3. T018–T019: Alert polling wired in
4. T020–T024: Scheduled workers + full mission lifecycle with checkpointing
5. T025–T032: Polish, exports, quality gate

