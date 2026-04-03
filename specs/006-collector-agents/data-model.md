# Data Model: Collector Agents

## ResearchPacket

**Type**: Pydantic model (shared)
**Location**: `packages/shared/src/finsight/shared/models/data_packet.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| mission_id | UUID | Mission this packet belongs to | required |
| target_symbol | str \| None | Primary ticker symbol under investigation | nullable |
| target_theme | str \| None | Theme/keyword if not symbol-specific | at least one of symbol/theme required |
| price_history | list[PriceBar] | OHLCV bars from market-data server | may be empty |
| current_price | Decimal \| None | Latest price snapshot | nullable |
| fundamentals | FundamentalData \| None | Fundamental data snapshot | nullable |
| news_items | list[NewsItem] | Recent news articles | may be empty |
| knowledge_entries | list[KnowledgeEntry] | Relevant past KB entries | may be empty |
| tool_errors | list[ToolError] | Errors from any failed tool calls | may be empty |
| collected_at | datetime | UTC timestamp of packet assembly | auto-set |
| researcher_run_id | UUID \| None | AgentRun.id for this Researcher execution | nullable |

**Note**: `PriceBar`, `FundamentalData`, `NewsItem`, `KnowledgeEntry`, `ToolError` are shared models defined in Feature 004 (`packages/shared`).

**Validation rules**:
- `model_validator(mode="after")`: at least one of `target_symbol` or `target_theme` must be non-None.
- An absent data section (e.g., empty `news_items`) is valid; a corresponding `ToolError` entry should explain the absence if it was due to a failure.

---

## Alert

**Type**: SQLAlchemy 2.x ORM model (defined in Feature 002; Watchdog writes to it)
**Location**: `apps/api/src/api/db/models/alert.py` (Feature 002)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | UUID | Primary key | auto-generated |
| watchlist_item_id | UUID | FK to watchlist_items.id | non-null, FK |
| condition_type | str | "price_move", "volume_spike", "news_spike" | enum-like |
| observed_value | Decimal | The value that triggered the alert | |
| threshold_value | Decimal | The configured threshold that was breached | |
| severity | str | "LOW", "MEDIUM", "HIGH", "CRITICAL" | enum-like |
| description | str | Human-readable description of the breach | non-empty |
| mission_id | UUID \| None | FK to missions.id; set when mission is opened | nullable, FK |
| created_at | datetime | UTC creation timestamp | server_default=now() |
| acknowledged_at | datetime \| None | UTC timestamp when operator acknowledged | nullable |

**Indexes**: `(watchlist_item_id, condition_type, created_at)` — used for deduplication query.

---

## WatchdogConfig

**Type**: Pydantic v2 BaseModel
**Location**: `config/schemas/watchdog.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| schedule_cron | str | Celery beat cron expression | non-empty |
| deduplication_window_minutes | int | Window for suppressing duplicate alerts | > 0, default 60 |
| price_thresholds | list[PriceThresholdRule] | Price-move alert rules | |
| volume_threshold | VolumeThresholdConfig | Volume spike configuration | |
| news_threshold | NewsThresholdConfig | News spike configuration | |

**YAML path**: `config/runtime/watchdog.yaml`

### PriceThresholdRule (nested)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| pct_change_min | Decimal | Minimum absolute % change to trigger | > 0 |
| pct_change_max | Decimal \| None | Upper bound (exclusive) for this severity band | nullable |
| severity | str | Alert severity for this band | "LOW","MEDIUM","HIGH","CRITICAL" |

### VolumeThresholdConfig (nested)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| spike_multiplier | Decimal | Ratio of current to 20-day avg volume to trigger | > 1.0, default 3.0 |
| severity | str | Fixed severity for volume spikes | non-empty |

### NewsThresholdConfig (nested)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| window_minutes | int | Time window to count news articles | > 0, default 60 |
| article_count_threshold | int | Article count within window to trigger | > 0, default 5 |
| severity | str | Fixed severity for news spikes | non-empty |

---

## WatchdogInput

**Type**: Pydantic model (agent input schema)
**Location**: `apps/api/src/api/agents/watchdog_agent.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| watchlist_items | list[WatchlistItemSnapshot] | Active watchlist items to evaluate | non-empty |
| run_id | UUID | Identifier for this Watchdog cycle | auto-generated |

### WatchlistItemSnapshot (nested, from shared models)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | UUID | WatchlistItem PK | |
| symbol | str \| None | Ticker symbol | |
| theme | str \| None | Theme keyword | |
| owner_user_id | UUID | Owning user | |

---

## WatchdogOutput

**Type**: Pydantic model (agent output schema, validated by BaseAgent)
**Location**: `apps/api/src/api/agents/watchdog_agent.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| alerts_created | list[AlertCreatedRecord] | Summary of alerts raised this cycle | may be empty |
| items_evaluated | int | Total watchlist items checked | >= 0 |
| items_skipped | int | Items skipped due to data unavailability | >= 0 |

### AlertCreatedRecord (nested)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| alert_id | UUID | ID of the created Alert record | |
| watchlist_item_id | UUID | Which item triggered it | |
| condition_type | str | "price_move", "volume_spike", "news_spike" | |
| severity | str | Alert severity | |

---

## ResearcherInput

**Type**: Pydantic model (agent input schema)
**Location**: `apps/api/src/api/agents/researcher_agent.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| mission_id | UUID | Mission to research | required |
| target_symbol | str \| None | Primary ticker | |
| target_theme | str \| None | Theme if not symbol-specific | |
| price_history_days | int | Number of days of OHLCV to fetch | 1–365, default 30 |
| news_lookback_hours | int | Hours of news history to fetch | 1–168, default 24 |
| knowledge_top_k | int | Max knowledge entries to retrieve | 1–50, default 10 |

---

## ResearcherOutput

**Type**: `ResearchPacket` (see above)
**Location**: `packages/shared/src/finsight/shared/models/data_packet.py`

The Researcher's `output_type` is `ResearchPacket`. BaseAgent validates the output against this schema before returning.
