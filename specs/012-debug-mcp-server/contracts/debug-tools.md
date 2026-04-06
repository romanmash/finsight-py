# Contract: Debug MCP Tools

All calls are exposed via JSON-RPC `tools/call` with `name` and `arguments`.
All successful and error returns use `ToolResponse[T]`.

## `debug.service_health`
- Inputs: none
- Output: `ToolResponse[ServiceHealthResult]`
- Rules:
  - Endpoints loaded from `config/runtime/mcp.yaml` `debug.health_endpoints`
  - Status values: `pass|fail|skip`

## `debug.compose_status`
- Inputs: none
- Output: `ToolResponse[ComposeStatusResult]`
- Rules:
  - Lists visible compose containers through Docker SDK

## `debug.tail_logs`
- Inputs: `service: str`, `lines: int = 100`
- Output: `ToolResponse[LogResult]`
- Validation:
  - `service` MUST be in allowlist
- Caps:
  - maximum returned lines = 1000, `capped=true` when truncated
- Security:
  - every returned line passed through `scrub()`
- Error cases:
  - unknown service returns structured error with valid names

## `debug.db_query`
- Inputs: `sql: str`, `params: list[object] = []`
- Output: `ToolResponse[DbQueryResult]`
- Validation:
  - SQL MUST pass SELECT-only validator
- Caps:
  - maximum rows returned = 500, `capped=true` when truncated
- Error cases:
  - non-SELECT statement rejected before DB call

## `debug.db_table_info`
- Inputs: `table: str`
- Output: `ToolResponse[DbTableInfoResult]`
- Validation:
  - table identifier validated against `information_schema`

## `debug.db_recent_rows`
- Inputs: `table: str`, `limit: int = 20`, `order_by: str = "id"`
- Output: `ToolResponse[DbQueryResult]`
- Validation:
  - table + order_by validated against schema metadata
- Caps:
  - effective limit max = 500, `capped=true` when truncated

## `debug.redis_get`
- Inputs: `key: str`
- Output: `ToolResponse[str | None]`

## `debug.redis_keys`
- Inputs: `pattern: str = "*"`
- Output: `ToolResponse[list[str]]`
- Caps:
  - maximum keys returned = 200

## `debug.redis_inspect`
- Inputs: `key: str`
- Output: `ToolResponse[RedisKeyResult]`
- Allowed Redis reads only:
  - `GET`, `KEYS`, `TYPE`, `TTL`, `STRLEN`, `LRANGE`, `HGETALL`, `SMEMBERS`, `ZRANGE`

## `debug.agent_runs`
- Inputs: `status: str | None = None`, `limit: int = 20`
- Output: `ToolResponse[AgentRunResult]`
- Caps:
  - effective limit max = 100

## `debug.mission_status`
- Inputs: `mission_id: str`
- Output: `ToolResponse[MissionStatusResult]`
- Error cases:
  - unknown mission returns structured error

## `debug.celery_inspect`
- Inputs: none
- Output: `ToolResponse[CeleryInspectResult]`

## `debug.alert_inspect`
- Inputs: `alert_id: str`
- Output: `ToolResponse[AlertInspectResult]`
- Error cases:
  - unknown alert returns structured error
