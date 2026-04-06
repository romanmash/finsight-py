# Implementation Plan: Debug MCP Server

**Branch**: `012-debug-mcp-server` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-debug-mcp-server/spec.md`

## Summary

Add a new compose-profiled `debug-mcp` FastAPI JSON-RPC server with secure, typed, read-only debugging tools for infrastructure, PostgreSQL, Redis, and mission/agent state. Integrate MCP client registrations for Codex and Claude, add `debug_reader` DB role migration, ship offline tests, and add reusable SpecKit skills for future MCP expansion.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: FastAPI, Uvicorn, asyncpg, redis[hiredis], docker (Python SDK), httpx, PyYAML, Pydantic v2, structlog
**Storage**: PostgreSQL (`DEBUG_DB_URL`) + Redis (`REDIS_URL`)
**Testing**: pytest + pytest-asyncio + AsyncMock + httpx ASGI client
**Target Platform**: Docker Compose debug profile on Linux/WSL development environment
**Project Type**: MCP microservice + infra/config/docs updates
**Performance Goals**: Tool responses complete under 2s for local dependencies; bounded outputs with explicit caps
**Constraints**: Read-only DB/Redis contracts, auth optional in dev only, offline tests only, no browser code in custom server
**Scale/Scope**: One new MCP server package, 10 tools, 6 test modules, migration, and documentation/config wiring

## Constitution Check

- [x] Everything-as-Code: health endpoints and runtime behavior sourced from `config/runtime/mcp.yaml` and env
- [x] Agent Boundaries: debug tools inspect state only; no role boundary crossover in agent logic
- [x] MCP Server Independence: server is isolated under `apps/mcp-servers/debug/` with its own `/health` and tool registry
- [x] Cost Observability: no LLM call paths introduced
- [x] Fail-Safe Defaults: invalid config exits early; invalid SQL rejected before execution; auth 401 on invalid token
- [x] Test-First/Offline: all tool tests mock external dependencies, no network/db/docker runtime needed
- [x] Simplicity Over Cleverness: plain FastAPI JSON-RPC pattern matching existing MCP servers

## Project Structure

### Documentation (this feature)

```text
specs/012-debug-mcp-server/
├── spec.md
├── research.md
├── plan.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── debug-tools.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
apps/mcp-servers/debug/
├── Dockerfile
├── pyproject.toml
├── src/debug_mcp/
│   ├── __init__.py
│   ├── server.py
│   ├── auth.py
│   ├── models.py
│   ├── scrub.py
│   └── tools/
│       ├── __init__.py
│       ├── infra.py
│       ├── db.py
│       ├── redis_tools.py
│       └── agents.py
└── tests/
    ├── __init__.py
    ├── test_auth.py
    ├── test_scrub.py
    ├── test_infra_tools.py
    ├── test_db_tools.py
    ├── test_redis_tools.py
    └── test_agent_tools.py

apps/api-service/alembic/versions/
└── 20260406_0005_create_debug_reader_role.py

.agents/skills/speckit-mcp-server/SKILL.md
.agents/skills/speckit-debug-mcp/SKILL.md
.claude/skills/speckit-mcp-server/SKILL.md
.claude/skills/speckit-debug-mcp/SKILL.md

.vscode/mcp.json
.claude/settings.json
docker-compose.yml
.env.example
config/runtime/mcp.yaml
pyproject.toml
README.md
AGENTS.md
specs/README.md
```

**Structure Decision**: Follow existing MCP server package layout and testing style from `market-data`/`news-macro` while keeping debug-only integration changes in root config/documentation files.

## Implementation Phases

### Phase 1: Foundation
- Add spec index entry and feature docs.
- Add workspace member and env/config placeholders.
- Add compose `debug-mcp` service profile and runtime env wiring.
- Add Alembic migration creating `debug_reader` role and grants.

### Phase 2: Server Shell
- Create debug package, Dockerfile, pyproject.
- Implement `server.py` JSON-RPC dispatch, tool registry, `/health`, startup checks.
- Implement `auth.py`, `models.py`, `scrub.py`.

### Phase 3: Tool Modules
- Implement infra tools (`service_health`, `compose_status`, `tail_logs`).
- Implement DB tools (`db_query`, `db_table_info`, `db_recent_rows`) with SELECT-only validator.
- Implement Redis tools (`redis_get`, `redis_keys`, `redis_inspect`) with read-only decode paths.
- Implement agent tools (`agent_runs`, `mission_status`, `celery_inspect`, `alert_inspect`).

### Phase 4: Tests
- Add auth/scrub/unit tool tests with mocks and cap boundary checks.
- Validate error paths and structured responses.

### Phase 5: Skills
- Add `speckit-mcp-server` and `speckit-debug-mcp` in both `.agents` and `.claude` skill trees.

### Phase 6: Config and Docs
- Merge MCP entries in `.claude/settings.json`.
- Add `.vscode/mcp.json` for Codex.
- Update AGENTS and README debug usage sections.

### Phase 7: Quality Gates
- Run:
  - `uv run mypy --strict`
  - `uv run ruff check apps/mcp-servers/debug/`
  - `uv run pytest apps/mcp-servers/debug/tests/`
- Run final full gates:
  - `uv run mypy --strict`
  - `uv run ruff check`
  - `uv run pytest`

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
