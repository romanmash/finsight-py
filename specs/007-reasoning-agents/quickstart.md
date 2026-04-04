# Quickstart: Reasoning Agents (007)

## Prerequisites

- Feature 002 (async data layer) applied: PostgreSQL running, Alembic migrations up to head
- Feature 005 (agent infrastructure) implemented: `AgentRun` ORM model, `record_agent_run` helper, `BaseAgent` ABC, `config/runtime/agents.yaml` present
- Feature 006 (collector agents) implemented: `DataPacket` and `ResearchPacket` Pydantic models available in `packages/shared`
- `.env` populated with `OPENAI_API_KEY` (or compatible endpoint in `LLM_BASE_URL`)
- `uv sync` completed at repo root

## Running Agents in Isolation (Development)

The reasoning agents are invoked by the Manager (Feature 008). For development testing, use the provided fixture scripts:

```bash
# Run Analyst agent against a synthetic DataPacket
uv run python -c "
import asyncio
from apps.api.src.api.agents.analyst_agent import AnalystAgent
from packages.shared.src.finsight.shared.models.data_packet import DataPacket
# ... build a test packet and call agent
"
```

## Applying the New Migration

```bash
uv run alembic upgrade head
```

This creates the `knowledge_entries` table with pgvector column (nullable at this stage).

## Running Tests

```bash
# All reasoning agent tests (offline — no network, no Docker required)
uv run pytest apps/api-service/tests/agents/test_analyst.py apps/api-service/tests/agents/test_pattern.py apps/api-service/tests/agents/test_bookkeeper.py apps/api-service/tests/agents/test_reporter.py -v

# With coverage
uv run pytest apps/api-service/tests/agents/ --cov=apps/api-service/src/api/agents --cov-report=term-missing -v

# Type check
uv run mypy --strict apps/api-service/src/api/agents/ packages/shared/src/finsight/shared/models/

# Lint
uv run ruff check apps/api-service/src/api/agents/ packages/shared/src/finsight/shared/models/
```

## Verifying Deduplication (Manual Smoke Test)

```bash
# Run the seed helper twice with the same payload — verify only one KnowledgeEntry exists
uv run python -m scripts.test_bookkeeper_dedup
```

## Key Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `OPENAI_API_KEY` | LLM calls (Analyst, Technician (Pattern Specialist), Reporter) | Yes |
| `LLM_BASE_URL` | Override for local LM Studio endpoint | No |
| `DATABASE_URL` | Async PostgreSQL DSN | Yes |

## Expected Test Output

```
tests/agents/test_analyst.py::test_analyst_produces_assessment PASSED
tests/agents/test_analyst.py::test_analyst_conflicting_signals PASSED
tests/agents/test_analyst.py::test_analyst_no_signal PASSED
tests/agents/test_pattern.py::test_pattern_identifies_golden_cross PASSED
tests/agents/test_pattern.py::test_pattern_no_clear_pattern PASSED
tests/agents/test_pattern.py::test_pattern_report_has_no_investment_advice PASSED
tests/agents/test_bookkeeper.py::test_bookkeeper_writes_entry PASSED
tests/agents/test_bookkeeper.py::test_bookkeeper_deduplicates_same_entity PASSED
tests/agents/test_bookkeeper.py::test_bookkeeper_flags_conflict PASSED
tests/agents/test_reporter.py::test_reporter_formats_assessment PASSED
tests/agents/test_reporter.py::test_reporter_adds_no_new_analysis PASSED
```
