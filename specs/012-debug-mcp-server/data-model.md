# Data Model: Debug MCP Server

## Response Envelope

| Model | Fields |
|---|---|
| `ToolResponse[T]` | `data: T | None`, `error: str | None`, `latency_ms: int` |

## Infrastructure Models

| Model | Fields |
|---|---|
| `ServiceHealth` | `name: str`, `endpoint: str`, `status: Literal["pass","fail","skip"]`, `status_code: int | None`, `latency_ms: int`, `error: str | None` |
| `ServiceHealthResult` | `all_healthy: bool`, `services: list[ServiceHealth]` |
| `ComposeService` | `name: str`, `status: str`, `running: bool`, `image: str`, `ports: list[str]` |
| `ComposeStatusResult` | `services: list[ComposeService]` |
| `LogResult` | `service: str`, `lines: list[str]`, `line_count: int`, `capped: bool` |

## Database Models

| Model | Fields |
|---|---|
| `DbQueryResult` | `columns: list[str]`, `rows: list[list[object | None]]`, `row_count: int`, `capped: bool` |
| `DbColumn` | `name: str`, `type: str`, `nullable: bool`, `default: str | None` |
| `DbTableInfoResult` | `table: str`, `columns: list[DbColumn]`, `row_estimate: int | None` |

## Redis Models

| Model | Fields |
|---|---|
| `RedisKeyResult` | `key: str`, `type: str`, `ttl: int | None`, `value: object | None`, `size: int | None` |

## Agent/Mission Models

| Model | Fields |
|---|---|
| `AgentRunSummary` | `id: str`, `agent_type: str`, `status: str`, `started_at: str`, `finished_at: str | None`, `error: str | None` |
| `AgentRunResult` | `runs: list[AgentRunSummary]`, `total_count: int` |
| `MissionStatusResult` | `mission_id: str`, `status: str`, `created_at: str`, `agent_runs: list[AgentRunSummary]` |
| `CeleryQueue` | `name: str`, `depth: int` |
| `CeleryInspectResult` | `active_tasks: int`, `queues: list[CeleryQueue]` |
| `AlertInspectResult` | `alert_id: str`, `condition_type: str`, `status: str`, `acknowledged_at: str | None`, `triggered_at: str | None` |

## Validation Rules

- `tail_logs.lines` input capped at 1000 output lines.
- `db_query` and `db_recent_rows` capped at 500 rows.
- `redis_keys` capped at 200 keys.
- `agent_runs.limit` capped at 100 records.
- `db_query` accepts only SELECT after comment stripping.
