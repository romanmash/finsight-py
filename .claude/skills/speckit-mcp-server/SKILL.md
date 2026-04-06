---
name: "speckit-mcp-server"
description: "Reference workflow for adding a new MCP server in FinSight."
compatibility: "FinSight monorepo"
---

## Purpose

Use this skill when implementing a new MCP server package under `apps/mcp-servers/`.

## Required Pattern

1. Use plain FastAPI HTTP JSON-RPC (no FastMCP SDK, no stdio server).
2. Follow `_tool_registry: dict[str, Callable[..., Any]]` with names `<domain>.<verb>_<noun>`.
3. Use typed `ToolResponse[T]` models in `models.py`.
4. Expose `GET /health` and `POST /mcp/` only.
5. Add `@app.on_event("startup")` connection validation and fail-fast behavior.

## File Checklist

- `apps/mcp-servers/<server>/Dockerfile` (mirror existing MCP Dockerfile pattern)
- `apps/mcp-servers/<server>/pyproject.toml`
- `apps/mcp-servers/<server>/src/<pkg>/server.py`
- `apps/mcp-servers/<server>/src/<pkg>/models.py`
- `apps/mcp-servers/<server>/src/<pkg>/tools/*.py`
- `apps/mcp-servers/<server>/tests/*.py`

## Integration Checklist

1. Add server directory to root `pyproject.toml` workspace members.
2. Add compose service in `docker-compose.yml` (profile + depends_on + env + mounts).
3. Add runtime config entry in `config/runtime/mcp.yaml`.
4. Register MCP in `.vscode/mcp.json` and `.claude/settings.json`.
5. Add feature spec entry in `specs/README.md`.

## Validation

Run:

```bash
uv run mypy --strict
uv run ruff check apps/mcp-servers/<server>/
uv run pytest apps/mcp-servers/<server>/tests/
```
