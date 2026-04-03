# Research: Orchestration (008)

## LangGraph Supervisor Pattern for Multi-Agent Routing

**Chosen**: `langgraph.graph.StateGraph` with a `GraphState` TypedDict and a supervisor node (`manager_agent`) that returns the next node name. The graph uses `add_conditional_edges` from the supervisor to each specialist agent node, and a terminal `END` edge when the pipeline is complete.
**Rationale**: LangGraph's supervisor pattern is the canonical approach for this architecture (see AGENTS.md). It provides checkpointing (via `SqliteSaver` / `PostgresSaver`), stateful resumption after restart, and a clean way to express conditional routing without custom orchestration code.
**Alternatives considered**: Pure Celery chain per pipeline (no state graph, no conditional routing, harder to extend), custom async orchestrator (reinventing LangGraph), Prefect/Airflow (too heavy for single-operator tool).

## LangGraph Checkpointing Backend

**Chosen**: `langgraph-checkpoint-postgres` (`PostgresSaver`) using the same PostgreSQL 16 database as the rest of the system, with a dedicated `langgraph_checkpoints` schema
**Rationale**: Single database for everything; checkpoints survive server restarts; `PostgresSaver` is the production-grade backend recommended by LangChain for always-on deployments.
**Alternatives considered**: `SqliteSaver` (dev/test only — not reliable under concurrent writes), Redis checkpointer (no durable persistence), in-memory (lost on restart).

## Celery as Execution Engine

**Chosen**: Celery 5.x with Redis 7 as broker + result backend. Each pipeline step (agent invocation) is a Celery task. The supervisor graph runs inside a Celery task so it is off the FastAPI event loop. Beat schedule drives periodic tasks (watchdog scan, daily brief, screener) from `config/runtime/scheduler.yaml`.
**Rationale**: Constitution specifies Celery + Redis. Celery's retry semantics (`autoretry_for`, `max_retries`, `retry_backoff`) map directly to FR-006. Beat schedule from YAML satisfies FR-005.
**Alternatives considered**: FastAPI BackgroundTasks (no retry, no persistence, lost on restart), APScheduler (no worker pool, no distributed execution).

## Mission Lifecycle State Machine

**Chosen**: `MissionStatus` enum: `PENDING → RUNNING → COMPLETED | FAILED`. Status transitions written to the `missions` table (Feature 002) at each step. Each transition is a single `UPDATE` in the Celery task, wrapped in a try/finally to ensure `FAILED` is written on exception.
**Rationale**: Simple three-state machine is sufficient. Database record provides the audit trail needed by the Dashboard (Feature 010) and Telegram delivery (Feature 009).
**Alternatives considered**: Event sourcing (overkill), Redis-only status (not durable).

## Alert-to-Mission Trigger Mechanism

**Chosen**: The `alert_worker` Celery task polls the `alerts` table for `status='PENDING'` alerts on a short interval (configurable in `scheduler.yaml`, default 30 s). On detection it calls `create_mission_from_alert` which creates a `Mission` row and dispatches the investigation Celery task. Alert is marked `status='PROCESSING'` atomically with mission creation.
**Rationale**: Polling avoids complexity of PostgreSQL LISTEN/NOTIFY integration and is sufficient for single-operator scale. The configurable poll interval keeps it tunable.
**Alternatives considered**: PostgreSQL LISTEN/NOTIFY (more complex, harder to test offline), Celery signal hooks (no clean alert model integration), Redis pub/sub (adds a second messaging layer).

## Pipeline Configuration in YAML

**Chosen**: `config/runtime/scheduler.yaml` defines each pipeline type as a named entry with: `agent_sequence: list[str]` (ordered agent node names), `cron: str` (for scheduled pipelines), `retry_policy: {max_retries: int, backoff_seconds: int}`. The Manager reads the pipeline definition at runtime to configure the graph edges.
**Rationale**: Satisfies FR-005 (configurable schedules) and FR-001 (adding a new pipeline type without code changes). Pydantic v2 schema validates the YAML at startup.
**Alternatives considered**: Hardcoded pipeline dictionaries (violates Everything-as-Code), database-stored pipelines (adds admin UI complexity).

## Offline Test Strategy for Orchestration

**Chosen**: `pytest-asyncio` + `unittest.mock` to patch Celery task dispatch (`task.delay` / `task.apply_async`). LangGraph graph tests use `SqliteSaver` (in-memory) as the checkpointer in test mode. A `TEST_QUEUE_BACKEND=memory` env flag is checked by `queues.py` to use Celery's `task_always_eager` mode.
**Rationale**: `always_eager` runs Celery tasks synchronously in-process, enabling full pipeline testing without a Redis broker. SqliteSaver works in-process for graph checkpointing.
**Alternatives considered**: Full Celery + Redis in tests (requires Docker, violates offline constraint), mocking every agent call individually (too granular, misses integration bugs).

## Manager Agent — Routing Without Content Reasoning

**Chosen**: The `ManagerAgent` uses an LLM call with a small system prompt that classifies incoming text into a named pipeline type (`investigation`, `daily_brief`, `screener_scan`). The classification output is a `PipelineClassification` Pydantic model containing only `pipeline_type: str` and `ticker: str | None`. No content reasoning, no analysis.
**Rationale**: Constitution: "Manager routes, never reasons about content." The LLM is used only for intent classification; all subsequent reasoning is delegated to specialist agents.
**Alternatives considered**: Regex/keyword routing (brittle for natural language), full LLM reasoning in Manager (violates agent boundaries).
