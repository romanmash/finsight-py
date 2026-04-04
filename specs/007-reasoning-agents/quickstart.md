# Quickstart: Reasoning Agents (007)

## Prerequisites

- Features 001–006 are implemented in the current branch.
- Runtime configs load successfully via `load_all_configs()` (includes `agents.yaml`, `watchdog.yaml`, `researcher.yaml`, etc.).
- `.env` has required DB and model-provider credentials for local runs.
- `uv sync` completed.

## Migration

Feature 007 introduces Knowledge Base persistence for Bookkeeper. Apply migrations before integration tests:

```bash
uv run alembic upgrade head
```

## Test Commands (Offline)

```bash
uv run pytest apps/api-service/tests/agents/test_analyst.py -v
uv run pytest apps/api-service/tests/agents/test_pattern.py -v
uv run pytest apps/api-service/tests/agents/test_bookkeeper.py -v
uv run pytest apps/api-service/tests/agents/test_reporter.py -v
```

## Quality Gates

```bash
uv run mypy --strict apps/api-service/src/api/agents/ packages/shared/src/finsight/shared/models/
uv run ruff check apps/api-service/src/api/agents/ packages/shared/src/finsight/shared/models/
```

## Notes

- Analyst, Technician (Pattern Specialist), and Reporter should use `BaseAgent` to ensure standard run recording.
- Bookkeeper remains deterministic (no LLM call) and must still write `AgentRun` entries with zero cost/tokens.
- Reasoning agents consume `ResearchPacket` from 006 and must not call MCP tools directly.
