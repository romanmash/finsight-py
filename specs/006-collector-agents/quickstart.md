# Quickstart: Collector Agents

## Prerequisites

- Feature 002 (data layer) migrations applied: `uv run alembic upgrade head`
- Feature 004 (MCP platform) servers running (tests run offline with mocks)
- Feature 005 (agent infrastructure) in place
- `.env` populated with `DATABASE_URL`, `REDIS_URL`
- `uv sync` completed

## Configuration

Edit `config/runtime/watchdog.yaml`:

```yaml
schedule_cron: "*/15 * * * *"       # every 15 minutes
deduplication_window_minutes: 60

price_thresholds:
  - pct_change_min: 2.0
    pct_change_max: 5.0
    severity: LOW
  - pct_change_min: 5.0
    pct_change_max: 10.0
    severity: MEDIUM
  - pct_change_min: 10.0
    pct_change_max: null
    severity: HIGH

volume_threshold:
  spike_multiplier: 3.0
  severity: MEDIUM

news_threshold:
  window_minutes: 60
  article_count_threshold: 5
  severity: LOW
```

## Testing

```bash
# All collector agent tests (offline, ~30s)
uv run pytest apps/api/tests/agents/test_watchdog.py apps/api/tests/agents/test_researcher.py -v

# Watchdog only
uv run pytest apps/api/tests/agents/test_watchdog.py -v

# Researcher only
uv run pytest apps/api/tests/agents/test_researcher.py -v

# Shared model tests
uv run pytest packages/shared/tests/models/test_data_packet.py -v

# Type check
uv run mypy --strict apps/api/src/api/agents/watchdog_agent.py apps/api/src/api/agents/researcher_agent.py packages/shared/src/finsight/shared/models/data_packet.py

# Lint
uv run ruff check apps/api/src/api/agents/watchdog_agent.py apps/api/src/api/agents/researcher_agent.py
```

## Running the Watchdog manually (requires running DB + MCP servers)

```bash
# Trigger a single Watchdog cycle via Celery task (ad-hoc)
uv run celery -A api.workers.celery_app call api.workers.watchdog.run_watchdog_cycle

# Or run directly (for debugging)
uv run python -c "
import asyncio
from api.agents.watchdog_agent import WatchdogAgent
# ... bootstrap agent and call run()
"
```

## Running the Researcher manually

```bash
uv run python -c "
import asyncio
from uuid import uuid4
from api.agents.researcher_agent import ResearcherAgent
from api.agents.researcher_agent import ResearcherInput

# requires running DB, Redis, and MCP servers
asyncio.run(ResearcherAgent(...).run(ResearcherInput(
    mission_id=uuid4(),
    target_symbol='AAPL',
    price_history_days=30,
    news_lookback_hours=24,
    knowledge_top_k=5,
)))
"
```

## Verifying

### Verify Watchdog creates an Alert

```bash
# Insert a watchlist item into DB, then run:
uv run python -m scripts.seed_watchlist_test_item  # if seeding script exists

# Run one Watchdog cycle
uv run celery -A api.workers.celery_app call api.workers.watchdog.run_watchdog_cycle

# Check alerts table
uv run python -c "
import asyncio
from api.lib.db import get_async_session
from sqlalchemy import select
from api.db.models.alert import Alert
async def check():
    async with get_async_session() as s:
        result = await s.execute(select(Alert).order_by(Alert.created_at.desc()).limit(5))
        for alert in result.scalars():
            print(alert.id, alert.condition_type, alert.severity)
asyncio.run(check())
"
```

### Verify ResearchPacket has no analytical content

The `ResearchPacket` Pydantic schema enforces structure. If the Researcher tries to add an `analysis` field or `conclusions`, Pydantic validation will raise a `ValidationError` and `BaseAgent.run()` will retry once and then mark the run failed. This is the intended behavior.
