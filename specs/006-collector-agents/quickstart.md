# Quickstart: Collector Agents

## Prerequisites

- Feature 001 config foundation active.
- Feature 004 MCP client active.
- Feature 005 agent infrastructure conventions active.
- Feature 002 repositories/models for `WatchlistItem`, `Alert`, `Mission`, `AgentRun` available.
- `uv sync` completed.

## Configuration

Update `config/runtime/watchdog.yaml` with the new 006 fields while preserving current shape:

```yaml
poll_interval_seconds: 30
alert_cooldown_seconds: 300
news_spike_rate_per_hour: 5
news_fetch_limit: 100
dedup_window_hours: 4
default_thresholds:
  price_change_pct: 2.0
  volume_spike_multiplier: 2.5
  rsi_overbought: 70.0
```

Add `config/runtime/researcher.yaml`:

```yaml
ohlcv_period: 1mo
news_limit: 10
kb_limit: 5
```

## Implementation Validation

```bash
uv run pytest apps/api-service/tests/agents/test_watchdog.py -v
uv run pytest apps/api-service/tests/agents/test_researcher.py -v
uv run mypy --strict apps/api-service/src/api/agents/watchdog_agent.py apps/api-service/src/api/agents/researcher_agent.py packages/shared/src/finsight/shared/models/research_packet.py
uv run ruff check apps/api-service/src/api/agents/watchdog_agent.py apps/api-service/src/api/agents/researcher_agent.py packages/shared/src/finsight/shared/models/research_packet.py
```

## Expected Runtime Behavior

- Watchdog evaluates thresholds and creates Alert + Mission when breached.
- Researcher assembles factual `ResearchPacket` and records any missing sections in `data_gaps`.
- Both write `AgentRun` records with `tokens_in=0`, `tokens_out=0`, `cost_usd=0.00`.
