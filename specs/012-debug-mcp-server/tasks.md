# Tasks: Debug MCP Server (012)

**Feature**: 012-debug-mcp-server
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Generated**: 2026-04-06

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create spec artifacts in `specs/012-debug-mcp-server/` (`spec.md`, `research.md`, `plan.md`, `data-model.md`, `quickstart.md`, `contracts/debug-tools.md`, `checklists/requirements.md`)
- [X] T002 Update root workspace membership in `pyproject.toml` to include `apps/mcp-servers/debug`
- [X] T003 [P] Add debug runtime env placeholders in `.env.example`
- [X] T004 [P] Add debug health endpoint config in `config/runtime/mcp.yaml`
- [X] T005 [P] Add `012` entry in `specs/README.md`

## Phase 2: Foundational (Blocking)

- [X] T006 Create Alembic migration `apps/api-service/alembic/versions/20260406_0005_create_debug_reader_role.py` for read-only `debug_reader` role/grants/default privileges
- [X] T007 Create package skeleton `apps/mcp-servers/debug/` (`Dockerfile`, `pyproject.toml`, `src/debug_mcp/__init__.py`, `tests/__init__.py`)
- [X] T008 Implement server shell `apps/mcp-servers/debug/src/debug_mcp/server.py` with JSON-RPC dispatch, startup checks, `/health`, and tool registry
- [X] T009 [P] Implement MCP auth dependency in `apps/mcp-servers/debug/src/debug_mcp/auth.py`
- [X] T010 [P] Implement result models in `apps/mcp-servers/debug/src/debug_mcp/models.py`
- [X] T011 [P] Implement secret scrubber in `apps/mcp-servers/debug/src/debug_mcp/scrub.py`

## Phase 3: User Story 1 - Infrastructure Debug Tools (Priority: P1)

**Goal**: expose health/status/log inspection tools.
**Independent Test**: infra tools return typed results, validate service allowlist, cap logs, and scrub secrets.

- [X] T012 [US1] Implement infra tools in `apps/mcp-servers/debug/src/debug_mcp/tools/infra.py`
- [X] T013 [US1] Add infra tool exports in `apps/mcp-servers/debug/src/debug_mcp/tools/__init__.py`
- [X] T014 [US1] Add infra tool registration in `apps/mcp-servers/debug/src/debug_mcp/server.py`
- [X] T015 [US1] Add infra tests in `apps/mcp-servers/debug/tests/test_infra_tools.py`

## Phase 4: User Story 2 - Read-Only DB Tools (Priority: P1)

**Goal**: expose safe SELECT-only DB introspection tools.
**Independent Test**: non-SELECT SQL rejected before DB call; table info/recent rows return capped typed output.

- [X] T016 [US2] Implement DB tools in `apps/mcp-servers/debug/src/debug_mcp/tools/db.py`
- [X] T017 [US2] Register DB tools in `apps/mcp-servers/debug/src/debug_mcp/server.py`
- [X] T018 [US2] Add DB tests in `apps/mcp-servers/debug/tests/test_db_tools.py`

## Phase 5: User Story 3 - Read-Only Redis Tools (Priority: P2)

**Goal**: expose key/value/type/ttl introspection without mutation.
**Independent Test**: keys cap enforced and inspect decodes string/list/hash/set/zset.

- [X] T019 [US3] Implement Redis tools in `apps/mcp-servers/debug/src/debug_mcp/tools/redis_tools.py`
- [X] T020 [US3] Register Redis tools in `apps/mcp-servers/debug/src/debug_mcp/server.py`
- [X] T021 [US3] Add Redis tests in `apps/mcp-servers/debug/tests/test_redis_tools.py`

## Phase 6: User Story 4 - Agent/Mission Debug Tools (Priority: P2)

**Goal**: expose agent run, mission, queue, and alert inspection.
**Independent Test**: status filters and missing-id errors return structured responses.

- [X] T022 [US4] Implement agent tools in `apps/mcp-servers/debug/src/debug_mcp/tools/agents.py`
- [X] T023 [US4] Register agent tools in `apps/mcp-servers/debug/src/debug_mcp/server.py`
- [X] T024 [US4] Add agent tool tests in `apps/mcp-servers/debug/tests/test_agent_tools.py`

## Phase 7: User Story 5 - Security Controls (Priority: P1)

**Goal**: enforce bearer auth and output scrubbing behavior.
**Independent Test**: token-required calls return 401 on missing/invalid credentials and scrub covers key patterns.

- [X] T025 [US5] Add endpoint auth tests in `apps/mcp-servers/debug/tests/test_auth.py`
- [X] T026 [US5] Add scrub tests in `apps/mcp-servers/debug/tests/test_scrub.py`

## Phase 8: Config, Skills, and Docs

- [X] T027 Add compose debug service to `docker-compose.yml`
- [X] T028 Add Codex MCP config in `.vscode/mcp.json`
- [X] T029 Merge debug MCP entries into `.claude/settings.json`
- [X] T030 Create skill `speckit-mcp-server` at `.agents/skills/speckit-mcp-server/SKILL.md`
- [X] T031 Create skill `speckit-debug-mcp` at `.agents/skills/speckit-debug-mcp/SKILL.md`
- [X] T032 Mirror both skills to `.claude/skills/speckit-mcp-server/SKILL.md` and `.claude/skills/speckit-debug-mcp/SKILL.md`
- [X] T033 Update debug usage instructions in `AGENTS.md`
- [X] T034 Update debug MCP section in `README.md`

## Phase 9: Quality Gates

- [X] T035 Run feature gates: `uv run mypy --strict`, `uv run ruff check apps/mcp-servers/debug/`, `uv run pytest apps/mcp-servers/debug/tests/`
- [X] T036 Run full gates: `uv run mypy --strict`, `uv run ruff check`, `uv run pytest`
- [X] T037 Mark all completed tasks as `[X]` in this file

## Dependencies & Execution Order

- Phase 1 must complete before all implementation phases.
- Phase 2 must complete before any user story phase.
- US1/US2/US3/US4 can proceed after Phase 2, with server registration updates sequenced to avoid conflicts.
- US5 depends on server auth/scrub modules from Phase 2.
- Phase 8 follows functional completion.
- Phase 9 is final validation and closeout.
