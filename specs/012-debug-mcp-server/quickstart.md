# Quickstart: Debug MCP Server

## 1. Start debug profile

```bash
docker compose --profile debug up -d debug-mcp
```

## 2. Verify server health

```bash
curl -s http://localhost:8010/health
```

Expected: `{"status":"healthy"}`.

## 3. Verify MCP registration

- Codex: `.vscode/mcp.json` contains `debug-infra` (HTTP) and `debug-browser` (docker stdio).
- Claude: `.claude/settings.json` merged with `mcpServers.debug-infra` and `mcpServers.debug-browser`.

## 4. Smoke tool list call

```bash
curl -s -X POST http://localhost:8010/mcp/ \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

If `DEBUG_MCP_TOKEN` is set, include `Authorization: Bearer <token>`.

## 5. Typical debug workflow

1. `debug.service_health`
2. `debug.compose_status`
3. `debug.tail_logs`
4. `debug.db_query` / `debug.db_recent_rows`
5. `debug.redis_inspect`
6. `debug.mission_status`

## 6. Run feature-local quality gates

```bash
uv run mypy --strict
uv run ruff check apps/mcp-servers/debug/
uv run pytest apps/mcp-servers/debug/tests/
```
