# Data Model: Collector Agents

## Prerequisite Entities (Feature 002)

Collector agents depend on these existing data-layer entities and repositories:

- `WatchlistItem` (read by Watchdog)
- `Alert` (written by Watchdog)
- `Mission` (written by Watchdog)
- `AgentRun` (written by Watchdog + Researcher)

If any of the above are absent in the active branch, 006 adds minimal compatible ORM/repository
implementations locally so collector agents can run and be tested.

---

## WatchdogConfig

**Type**: Pydantic v2 BaseModel
**Location**: `config/schemas/watchdog.py`

### Existing fields (already present)

| Field | Type |
|---|---|
| `poll_interval_seconds` | `int` |
| `alert_cooldown_seconds` | `int` |
| `default_thresholds.price_change_pct` | `float` |
| `default_thresholds.volume_spike_multiplier` | `float` |
| `default_thresholds.rsi_overbought` | `float` |

### Fields added by 006

| Field | Type | Default | Description |
|---|---|---|---|
| `news_spike_rate_per_hour` | `int` | `5` | News volume trigger threshold |
| `news_fetch_limit` | `int` | `100` | Max news items fetched per watchlist item run |
| `dedup_window_hours` | `int` | `4` | Duplicate-alert suppression window |

---

## ResearcherConfig

**Type**: Pydantic v2 BaseModel
**Location**: `config/schemas/researcher.py`

| Field | Type | Default | Description |
|---|---|---|---|
| `ohlcv_period` | `str` | `"1mo"` | OHLCV lookback period passed to MCP |
| `news_limit` | `int` | `10` | Max news items per run |
| `kb_limit` | `int` | `5` | Max KB entries per run |

---

## ResearchPacket

**Type**: Shared Pydantic model
**Location**: `packages/shared/src/finsight/shared/models/research_packet.py`

| Field | Type | Description |
|---|---|---|
| `ticker` | `str` | Target ticker symbol |
| `mission_id` | `UUID` | Mission identifier |
| `price_history` | `list[OHLCVBar] \| None` | Historical bars from market MCP |
| `fundamentals` | `FundamentalsSnapshot \| None` | Fundamentals snapshot |
| `news_items` | `list[NewsItem]` | Recent news records |
| `kb_entries` | `list[KnowledgeSnippet]` | Retrieved knowledge items |
| `data_gaps` | `list[str]` | Explicit missing-data notes |

### Supporting shared models

- `OHLCVBar`
- `FundamentalsSnapshot`
- `NewsItem`
- `KnowledgeSnippet`

All defined in `research_packet.py` for strict typing and offline validation.

---

## WatchdogResult

**Type**: Pydantic model
**Location**: `apps/api-service/src/api/agents/watchdog_agent.py`

| Field | Type | Description |
|---|---|---|
| `alerts_created` | `int` | Number of new alerts created |
| `missions_opened` | `int` | Number of missions opened |
| `items_evaluated` | `int` | Watchlist items processed |
| `dedup_skipped` | `int` | Alerts skipped by dedup window |

---

## ResearchInput

**Type**: Pydantic model
**Location**: `apps/api-service/src/api/agents/researcher_agent.py`

| Field | Type |
|---|---|
| `ticker` | `str` |
| `mission_id` | `UUID` |

---

## AgentRun recording policy

Both collector agents are deterministic and make no LLM calls.

- `tokens_in = 0`
- `tokens_out = 0`
- `cost_usd = Decimal("0.00")`
- `status = "completed"` on success, `"failed"` on unrecoverable errors

This aligns 006 with the 005 observability contract while avoiding fake token accounting.

---

## Alert Dedup Key

`Alert.condition_type` stores structured condition identifiers:
- `price_move`
- `volume_spike`
- `news_spike`

Watchdog dedup queries use `condition_type` + `ticker` + time window, not free-text matching.
