# Data Model: Orchestration (008)

## GraphState (LangGraph TypedDict)

**Type**: TypedDict (LangGraph state)
**Location**: `apps/api-service/src/api/graphs/state.py`

| Field | Python Type | Description |
|-------|-------------|-------------|
| mission_id | UUID | Active mission |
| pipeline_type | str | "investigation", "daily_brief", "screener_scan" |
| ticker | str \| None | Target asset (if applicable) |
| research_packet | ResearchPacket \| None | Researcher output |
| assessment | Assessment \| None | Analyst output |
| pattern_report | PatternReport \| None | Technician (Pattern Specialist) output |
| formatted_summary | str \| None | Reporter output |
| error | str \| None | Last error message |
| completed_nodes | list[str] | For checkpoint/resume tracking |

---

## PipelineConfig (YAML-backed)

**Type**: Pydantic v2 model
**Location**: `config/schemas/scheduler.py`

| Field | Python Type | Description |
|-------|-------------|-------------|
| name | str | Pipeline identifier |
| agent_sequence | list[str] | Ordered agent node names |
| cron | str \| None | Cron expression (for scheduled pipelines) |
| max_retries | int | Per-agent-step retry count (default 1) |
| retry_backoff_seconds | int | Backoff between retries (default 5) |

---

## SchedulerConfig (YAML-backed)

**Type**: Pydantic v2 model
**Location**: `config/schemas/scheduler.py`

| Field | Python Type | Description |
|-------|-------------|-------------|
| pipelines | list[PipelineConfig] | All pipeline definitions |
| alert_poll_interval_seconds | int | Alert detection poll interval (default 30) |
| daily_brief_cron | str | Default "0 7 * * MON-FRI" |

---

## Mission state transitions

```
PENDING → RUNNING (when Celery task picks it up)
RUNNING → COMPLETED (when final agent node completes)
RUNNING → FAILED (on unrecoverable error after retries)
```

Stored in `missions.status` column (Feature 002).

---

## PipelineClassification (Manager LLM output)

**Type**: Pydantic v2 model
**Location**: `apps/api-service/src/api/agents/manager_agent.py`

| Field | Python Type | Description |
|-------|-------------|-------------|
| pipeline_type | Literal["investigation", "daily_brief", "screener_scan", "unknown"] | Classified intent |
| ticker | str \| None | Extracted asset ticker |
| confidence | float | 0.0–1.0 classification confidence |
