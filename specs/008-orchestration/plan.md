# Implementation Plan: Orchestration

**Branch**: `008-orchestration` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Implement the Manager agent (LangGraph supervisor — intent classification and routing only),
the LangGraph supervisor graph with checkpointing (PostgresSaver), Celery workers for all
scheduled pipelines (watchdog scan, screener, daily brief, alert trigger), mission lifecycle
state machine (PENDING→RUNNING→COMPLETED/FAILED), and the `/missions` FastAPI routes. Pipelines
and schedules are fully configurable in scheduler.yaml.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: langgraph>=0.1, langgraph-checkpoint-postgres, celery[redis]>=5.3, celery[gevent], langchain-openai
**Storage**: PostgreSQL (missions table + langgraph_checkpoints schema), Redis (Celery broker + beat schedule)
**Testing**: pytest + pytest-asyncio + Celery task_always_eager + SqliteSaver checkpointer (offline)
**Target Platform**: Linux server (Docker) — api + celery-worker + celery-beat containers
**Project Type**: Orchestration layer within apps/api
**Performance Goals**: Operator query → response < 3 min; alert-triggered mission starts < 60 s; daily brief < 5 min
**Constraints**: mypy --strict; offline tests; no Celery broker needed in tests (always_eager)
**Scale/Scope**: 3 pipeline types; 5 Celery periodic tasks; 1 supervisor graph

## Constitution Check

- [x] Everything-as-Code — pipeline sequences, schedules, retry policies in config/runtime/scheduler.yaml
- [x] Agent Boundaries — Manager classifies intent only; NEVER reasons about content
- [x] MCP Server Independence — N/A (orchestration layer does not call MCP tools directly)
- [x] Cost Observability — Manager's LLM call recorded via BaseAgent infrastructure
- [x] Fail-Safe Defaults — failed agent step → retry per policy → mark mission FAILED; operator notified
- [x] Test-First — pipeline tests with Celery always_eager; graph tests with SqliteSaver
- [x] Simplicity Over Cleverness — LangGraph supervisor pattern; Celery for scheduling (no custom scheduler)

## Project Structure

### Source Code

```text
apps/api/src/api/
├── agents/
│   ├── manager_agent.py         # ManagerAgent: PipelineClassification output only
│   └── manager_agent.prompt.py
├── graphs/
│   ├── __init__.py
│   ├── state.py                 # GraphState TypedDict
│   ├── supervisor.py            # LangGraph StateGraph with supervisor pattern
│   └── nodes.py                 # Node wrappers for each agent
├── workers/
│   ├── __init__.py
│   ├── watchdog_worker.py       # Celery task: run Watchdog agent
│   ├── screener_worker.py       # Celery task: run screener pipeline
│   ├── brief_worker.py          # Celery task: run daily brief pipeline
│   ├── alert_worker.py          # Celery task: poll alerts → trigger missions
│   └── mission_worker.py        # Celery task: execute full mission pipeline
├── lib/
│   └── queues.py                # Celery app + beat schedule from scheduler.yaml
└── routes/
    └── missions.py              # POST /missions, GET /missions/{id}, GET /missions

config/runtime/
└── scheduler.yaml               # pipeline definitions, cron schedules, retry policies

config/schemas/
└── scheduler.py                 # Pydantic v2 schema

apps/api/tests/orchestration/
├── conftest.py                  # always_eager fixture, mock agents
├── test_manager.py              # intent classification
├── test_supervisor.py           # graph routing
├── test_mission_worker.py       # full pipeline (mocked agents)
└── test_alert_worker.py         # alert poll → mission creation
```

## Implementation Phases

### Phase 1: Config

**Files**: `config/runtime/scheduler.yaml`, `config/schemas/scheduler.py`

**Key decisions**:
- `pipelines.investigation.agent_sequence: [researcher, analyst, pattern_specialist, bookkeeper, reporter]`
- `pipelines.daily_brief.agent_sequence: [researcher, analyst, reporter]`
- `pipelines.daily_brief.cron: "0 7 * * MON-FRI"`
- `alert_poll_interval_seconds: 30`

### Phase 2: Celery App + Beat Schedule

**Files**: `apps/api/src/api/lib/queues.py`

**Key decisions**:
- `Celery("finsight", broker=settings.redis_url, backend=settings.redis_url)`
- Beat schedule built from scheduler.yaml at startup (not hardcoded)
- `task_always_eager=True` when `CELERY_TASK_ALWAYS_EAGER=true` env var set (test mode)

### Phase 3: LangGraph Supervisor

**Files**: `apps/api/src/api/graphs/state.py`, `supervisor.py`, `nodes.py`

**Key decisions**:
- `GraphState` TypedDict with all inter-agent fields
- Supervisor node calls `ManagerAgent` → returns next node name from `PipelineClassification`
- `add_conditional_edges(supervisor_node, routing_fn, {...agent: agent_node, END: END})`
- `PostgresSaver` checkpointer in production; `SqliteSaver(":memory:")` in tests

### Phase 4: Celery Workers

**Files**: `apps/api/src/api/workers/*.py`

**Key decisions**:
- `mission_worker.py`: receives mission_id → creates LangGraph graph instance → runs with checkpointer → updates mission status
- `alert_worker.py`: polls `AlertRepository.get_pending()` → creates Mission → dispatches `mission_worker.delay()`
- Each worker updates mission status (RUNNING on start, COMPLETED/FAILED on end)

### Phase 5: Mission Routes

**Files**: `apps/api/src/api/routes/missions.py`

**Key decisions**:
- `POST /missions` — creates Mission (PENDING), dispatches Celery task, returns mission_id
- `GET /missions/{id}` — returns mission with status + all AgentRun records
- `GET /missions` — paginated list, filterable by status

### Phase 6: Manager Agent

**Files**: `apps/api/src/api/agents/manager_agent.py` + `.prompt.py`

**Key decisions**:
- Input: raw text query
- Output: `PipelineClassification(pipeline_type, ticker, confidence)`
- ONLY LLM call in Manager; no content analysis

### Phase 7: Tests

- `conftest.py` sets `CELERY_TASK_ALWAYS_EAGER=true`
- Mission lifecycle test: POST /missions → Celery runs → DB shows COMPLETED
- Alert trigger test: create Alert → `alert_worker.delay()` → Mission created

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Graph checkpointing | PostgresSaver (prod) / SqliteSaver (test) | Durable state across restarts |
| Pipeline config | YAML agent_sequence list | New pipeline types without code changes |
| Alert detection | Celery beat polling (30s) | Simpler than DB triggers; tunable interval |
| Manager LLM task | Intent classification only | Constitution: Manager never reasons about content |
| Test isolation | task_always_eager | No Redis broker needed; synchronous execution |

## Testing Strategy

- All agents mocked with AsyncMock returning fixture outputs
- Graph tested with SqliteSaver(":memory:") — no PostgreSQL
- Celery tasks tested synchronously via always_eager
- Mission status transitions verified at each step

## Dependencies

- **Requires**: 005 (BaseAgent), 006 (Watchdog, Researcher), 007 (Analyst, Pattern, Bookkeeper, Reporter), 002 (repos), 003 (auth for routes)
- **Required by**: 009-telegram-bot-voice, 010-operator-dashboard
