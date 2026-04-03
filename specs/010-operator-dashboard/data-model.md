# Data Model: Operator Dashboard (010)

The dashboard is a read-mostly consumer of the API. It writes only through dedicated API
endpoints (watchlist CRUD, alert acknowledgement). No direct database access from the dashboard
app. The models below describe configuration schemas, API response shapes, and Dash store
structures used client-side.

---

## DashboardConfig

**Type**: config schema (Pydantic v2 `BaseSettings`)
**Location**: `config/schemas/dashboard.py`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `api_base_url` | `str` | `http://localhost:8000` | FastAPI base URL |
| `poll_interval_ms` | `int` | `5000` | `dcc.Interval` period in milliseconds |
| `mission_poll_interval_ms` | `int` | `10000` | Detail view refresh period |
| `auth_bypass_localhost` | `bool` | `true` | Skip JWT when request is from 127.0.0.1 |
| `page_size_missions` | `int` | `20` | Max missions shown in the list |
| `page_size_kb` | `int` | `25` | Max KB entries per search result page |
| `touch_target_min_px` | `int` | `48` | Minimum touch target size enforced via CSS |

**Loaded from**: `config/runtime/dashboard.yaml`
**Validated at**: Dash app startup in `apps/dashboard/src/dashboard/main.py`

---

## MissionCardData

**Type**: API response shape (dataclass, not ORM)
**Location**: `apps/dashboard/src/dashboard/api_client.py`

Returned by `GET /api/missions?status=active&limit=N`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` (UUID) | Mission primary key |
| `mission_type` | `str` | e.g. `daily_brief`, `pattern_request`, `deep_dive` |
| `target` | `str` | Primary ticker or entity |
| `status` | `str` | `pending`, `running`, `completed`, `failed` |
| `created_at` | `datetime` | Mission start timestamp |
| `completed_at` | `datetime \| None` | Completion timestamp |
| `duration_seconds` | `float \| None` | Wall-clock duration |

---

## MissionDetailData

**Type**: API response shape
**Location**: `apps/dashboard/src/dashboard/api_client.py`

Returned by `GET /api/missions/{id}`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | Mission primary key |
| `mission_type` | `str` | Mission type |
| `target` | `str` | Primary ticker |
| `status` | `str` | Current status |
| `agent_runs` | `list[AgentRunData]` | Ordered agent outputs |
| `output_summary` | `str \| None` | Final Reporter summary |
| `tickers` | `list[str]` | All tickers involved |
| `input_data` | `dict[str, Any]` | Original trigger payload |

### AgentRunData (nested)

| Field | Type | Description |
|-------|------|-------------|
| `agent_name` | `str` | Agent identifier (e.g. `researcher`, `analyst`) |
| `status` | `str` | `completed`, `failed` |
| `output_data` | `dict[str, Any]` | Agent output payload |
| `confidence` | `str \| None` | `low`, `medium`, `high` |
| `confidence_reason` | `str \| None` | Explanation of confidence rating |
| `duration_ms` | `int` | Agent wall-clock duration |
| `tokens_in` | `int` | Input token count |
| `tokens_out` | `int` | Output token count |
| `cost_usd` | `float` | Recorded cost |

---

## WatchlistItemData

**Type**: API response shape
**Location**: `apps/dashboard/src/dashboard/api_client.py`

Returned by `GET /api/watchlist` and used by the watchlist editor form.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | Item primary key |
| `ticker` | `str` | Asset symbol |
| `name` | `str` | Display name |
| `sector` | `str \| None` | Sector classification |
| `list_type` | `str` | `portfolio` or `interesting` |
| `active` | `bool` | Whether Watchdog evaluates this item |
| `alert_threshold_pct` | `float \| None` | Price-move alert threshold (percent) |

---

## KbEntryData

**Type**: API response shape
**Location**: `apps/dashboard/src/dashboard/api_client.py`

Returned by `GET /api/kb/search?q=<query>&limit=N`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | Entry primary key |
| `ticker` | `str` | Associated ticker |
| `entry_type` | `str` | e.g. `thesis_current`, `document_chunk` |
| `content` | `str` | Curated content text |
| `confidence` | `str \| None` | Agent confidence rating |
| `source_agent` | `str \| None` | Agent that wrote the entry |
| `contradiction_flag` | `bool` | Whether a conflict is recorded |
| `contradiction_note` | `str \| None` | Conflict description |
| `updated_at` | `datetime` | Last update timestamp |

---

## AlertData

**Type**: API response shape
**Location**: `apps/dashboard/src/dashboard/api_client.py`

Returned by `GET /api/alerts?acknowledged=false`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | Alert primary key |
| `ticker` | `str \| None` | Associated ticker |
| `alert_type` | `str` | e.g. `earnings_approaching`, `price_move` |
| `severity` | `str` | `low`, `medium`, `high` |
| `message` | `str` | Human-readable alert text |
| `acknowledged` | `bool` | Whether operator has acknowledged |
| `created_at` | `datetime` | When the alert was raised |

---

## DashClientStore

**Type**: Dash `dcc.Store` contents (JSON-serialisable dict)
**Location**: `apps/dashboard/src/dashboard/auth.py`

Held in `dcc.Store(id="auth-store", storage_type="session")`. Never written to `localStorage`.

| Field | Type | Description |
|-------|------|-------------|
| `access_token` | `str \| None` | Current JWT access token |
| `expires_at` | `float \| None` | Unix timestamp of token expiry |
| `operator_role` | `str \| None` | `admin` or `viewer` |
