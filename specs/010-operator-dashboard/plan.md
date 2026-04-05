# Implementation Plan: Operator Dashboard

**Branch**: `010-operator-dashboard` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Build the Dash (Plotly) operator console for FinSight AI Hub. The dashboard provides instant
situational awareness (mission list, watchlist status, unacknowledged alerts, recent agent
activity), a mission detail view with full evidence chain, a watchlist editor, a KB browser, and
a system health panel. This feature also includes FastAPI route extensions required by the dashboard (watchlist, alerts, knowledge browser, and dashboard health aggregation). All dashboard data is fetched from the FastAPI backend via HTTP; the dashboard never touches the database directly. Live updates are delivered by `dcc.Interval` polling — no
WebSockets. The UI is touchscreen-ready with 48 px minimum touch targets.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: `dash>=2.16`, `plotly`, `httpx`, `pydantic>=2.0`, `pyyaml`, `structlog`
**Storage**: Dashboard: none (HTTP consumer only); API extensions: PostgreSQL via existing repositories
**Testing**: `pytest`, `pytest-asyncio`, `respx` (offline, no browser, no Docker)
**Target Platform**: Linux server (Docker) / Windows 11 dev (Podman); browser on operator laptop
**Project Type**: Dash multi-page web application inside uv workspace
**Performance Goals**: Initial load <3 s; data refresh within 10 s of state change; tap response <300 ms
**Constraints**: mypy --strict zero errors; ruff zero warnings; no WebSockets; all tests offline;
  touch targets ≥48 px; no direct DB access from dashboard
**Scale/Scope**: ~6 pages, ~15 callbacks, ~10 reusable components, 1 API client, 1 auth module

## Constitution Check

- [x] Everything-as-Code — poll intervals, API URL, auth bypass all in `config/runtime/dashboard.yaml`; validated by Pydantic v2 at startup
- [x] Agent Boundaries — dashboard is a pure consumer; it does not run agents or interpret data
- [x] MCP Server Independence — N/A (dashboard does not call MCP servers)
- [x] Cost Observability — N/A (dashboard displays cost data from AgentRun records; does not incur LLM cost)
- [x] Fail-Safe Defaults — API unreachable → structured error panel, not blank; `sys.exit(1)` on bad config
- [x] Test-First — all callbacks tested as pure Python functions with `respx` HTTP mocks
- [x] Simplicity Over Cleverness — `dcc.Interval` polling; no custom JS; no WebSockets; no external state store

## Project Structure

### Source Code

```text
apps/api-service/
└── src/api/routes/
    ├── watchlist.py                      # CRUD routes for watchlist items
    ├── alerts.py                         # list + acknowledge alert routes
    ├── knowledge.py                      # KB browse/search routes for dashboard
    └── dashboard.py                      # consolidated dashboard health/activity routes
apps/dashboard/
├── pyproject.toml
├── src/
│   └── dashboard/
│       ├── __init__.py
│       ├── main.py                        # Dash app instance, layout, server entry point
│       ├── auth.py                        # JWT dcc.Store management + localhost bypass
│       ├── api_client.py                  # httpx AsyncClient wrapper for all FastAPI calls
│       ├── pages/
│       │   ├── __init__.py
│       │   ├── overview.py               # /  — mission list + alerts + activity summary
│       │   ├── missions.py               # /missions and /missions/<id>
│       │   ├── watchlist.py              # /watchlist — CRUD editor
│       │   ├── kb.py                     # /kb — KB browser + search
│       │   └── health.py                 # /health — container health indicators
│       ├── components/
│       │   ├── __init__.py
│       │   ├── mission_card.py           # MissionCard component
│       │   ├── agent_run_panel.py        # AgentRunPanel for mission detail
│       │   ├── alert_badge.py            # Alert count badge + panel
│       │   ├── watchlist_form.py         # Add/edit watchlist item form
│       │   ├── kb_entry_card.py          # KB entry display card
│       │   └── health_indicator.py       # Per-container health dot + label
│       └── assets/
│           └── styles.css                # Touch target sizing, global typography
├── tests/
│   ├── conftest.py                       # respx mocks, config fixtures
│   └── test_callbacks.py                 # Offline callback unit tests
config/
├── runtime/
│   └── dashboard.yaml                    # Runtime config values
└── schemas/
    └── dashboard.py                      # Pydantic v2 DashboardConfig schema
```
## Implementation Phases

### Phase 0: API Surface Completion

**Files**:
- `apps/api-service/src/api/routes/watchlist.py` — list/create/update/delete watchlist items
- `apps/api-service/src/api/routes/alerts.py` — list alerts + acknowledge alert action
- `apps/api-service/src/api/routes/knowledge.py` — browse/search knowledge entries for dashboard
- `apps/api-service/src/api/routes/dashboard.py` — overview-friendly aggregate endpoint(s) for status/activity
- `apps/api-service/src/api/main.py` — include new routers

**Key design**: Implement missing dashboard-facing routes in this feature so the dashboard stays a pure HTTP consumer and does not require direct database access.

### Phase 1: Config Schema and App Skeleton

**Files**:
- `config/schemas/dashboard.py` — `DashboardConfig` Pydantic v2 BaseSettings
- `config/runtime/dashboard.yaml` — default runtime values
- `apps/dashboard/pyproject.toml` — uv workspace package declaration
- `apps/dashboard/src/dashboard/__init__.py`
- `apps/dashboard/src/dashboard/main.py` — Dash app instance, Dash Pages registration, top-level
  layout with `dcc.Location`, `dcc.Store(id="auth-store")`, `dcc.Interval`, navbar, page
  container; loads and validates `DashboardConfig` at import; `sys.exit(1)` on failure

**Key design**: `main.py` calls `DashboardConfig.model_validate(yaml.safe_load(...))` at module
level. Any field error raises `ValidationError` which is caught and printed with the Pydantic
error path before `sys.exit(1)`.

### Phase 2: Auth Module and API Client

**Files**:
- `apps/dashboard/src/dashboard/auth.py` — `get_token(store_data)` and `refresh_if_needed(store_data)`
  functions; returns `BYPASS_TOKEN_SENTINEL` when `auth_bypass_localhost=true` and the request
  originates from `127.0.0.1`; token written only to `dcc.Store` session storage
- `apps/dashboard/src/dashboard/api_client.py` — `ApiClient` class wrapping `httpx.AsyncClient`;
  methods: `get_missions`, `get_mission`, `get_watchlist`, `upsert_watchlist_item`,
  `delete_watchlist_item`, `get_kb_entries`, `get_alerts`, `acknowledge_alert`,
  `get_health`; all methods accept an `access_token: str | None` header arg; connection errors
  return typed `ApiError` dataclass (never raise)

### Phase 3: Reusable Components

**Files** (`apps/dashboard/src/dashboard/components/`):
- `mission_card.py` — `mission_card(data: MissionCardData) -> dash.html.Div`; tap target ≥48 px
- `agent_run_panel.py` — `agent_run_panel(run: AgentRunData) -> dash.html.Div`; shows agent
  name badge, confidence chip, cost, duration, and collapsible output JSON
- `alert_badge.py` — `alert_badge(count: int) -> dash.html.Span`; red badge with count
- `watchlist_form.py` — `watchlist_form(item: WatchlistItemData | None) -> dash.html.Div`; form
  for add/edit with ticker, name, sector, list_type, active toggle, threshold input
- `kb_entry_card.py` — `kb_entry_card(entry: KbEntryData) -> dash.html.Div`; conflict indicator
  rendered when `entry.conflict_markers` is non-empty (matches the `conflict_markers: list[str]`
  field on `KnowledgeEntry` from Feature 007)
- `health_indicator.py` — `health_indicator(service: str, status: str) -> dash.html.Div`; green/
  amber/red dot + label; touch target ≥48 px
- `assets/styles.css` — CSS custom properties: `--touch-target: 48px`; all `button`, `.card`,
  `.nav-link` get `min-height: var(--touch-target)` and `min-width: var(--touch-target)`

### Phase 4: Pages and Callbacks

**Files** (`apps/dashboard/src/dashboard/pages/`):

- `overview.py` — layout: mission summary strip (active count, last run), unacknowledged alert
  count, recent activity feed; callback on `dcc.Interval` calls `api_client.get_missions` and
  `api_client.get_alerts`; error state renders `dcc.Alert` error panel

- `missions.py` — layout: filterable mission table (status filter buttons); clicking a row sets
  `dcc.Location.pathname` to `/missions/<id>`; detail sub-layout rendered when `id` is present;
  detail view shows `agent_run_panel` for each AgentRun in order; `dcc.Interval` refreshes
  detail when mission `status != "completed"`

- `watchlist.py` — layout: table of current watchlist items (ticker, name, sector, list_type,
  active toggle, threshold); "Add Item" button opens `watchlist_form` modal; save triggers POST
  to `/watchlist`; delete triggers DELETE; table refreshes via `dcc.Interval`

- `kb.py` — layout: search input + "Search" button; results rendered as list of `kb_entry_card`;
  conflict entries highlighted with amber border; pagination via `page_size_kb` from config

- `health.py` — layout: grid of `health_indicator` for each of the 10 Docker services; last
  refresh timestamp; `dcc.Interval` at `poll_interval_ms`; stale data (>30 s) renders amber
  "Stale" badge on all indicators

### Phase 5: Tests

**Files**:
- `apps/dashboard/tests/conftest.py` — `DashboardConfig` fixture with test values; `respx`
  router fixture mocking all API endpoints; sample `MissionCardData`, `AlertData`,
  `WatchlistItemData`, `KbEntryData`, `AgentRunData` fixtures

- `apps/dashboard/tests/test_callbacks.py` — tests for:
  - Overview callback returns mission and alert data from mocked API
  - Overview callback renders error panel when API returns 503
  - Mission list callback filters by status
  - Mission detail callback shows all agent runs in order
  - Watchlist save callback calls correct API endpoint with correct payload
  - Watchlist delete callback calls DELETE endpoint
  - KB search callback returns entries matching query
  - Health callback marks indicators stale when last_updated > 30 s ago
  - Auth bypass returns `BYPASS_TOKEN_SENTINEL` when `auth_bypass_localhost=true`
  - Auth refresh calls `/auth/refresh` when token is within 30 s of expiry

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Polling mechanism | `dcc.Interval` | Constitution forbids WebSocket complexity; idiomatic Dash pattern |
| API access pattern | Server-side in callbacks via `httpx` | Token never sent to browser JS context |
| Auth on localhost | Config-driven bypass flag | Operator console is local; zero friction for daily use |
| Callback testing | Pure-function extraction + `respx` | Offline constraint forbids browser/Selenium/Docker |
| Touch targets | 48 px CSS custom property | WCAG 2.5.5 + margin for laptop touchscreen imprecision |
| Error display | Typed `ApiError` + `dcc.Alert` panel | Blank panels are worse than visible errors for an ops console |
| Multi-page routing | Dash Pages + `dcc.Location` | Deep-linkable mission detail URLs survive browser refresh |

## Testing Strategy

All tests in `apps/dashboard/tests/test_callbacks.py` are offline:

1. Callbacks are implemented as thin wrappers over pure functions; the pure functions are imported
   directly in tests.
2. `respx` intercepts all `httpx` calls and returns fixture JSON.
3. No `dash.testing`, no headless browser, no Docker.
4. `pytest-asyncio` handles async callback helpers.

Coverage targets: all callback branches (success path, API error path, empty result path).

## Dependencies

- **Requires**: 001 (config/shared), 002 (data layer — entities visible in dashboard), 003 (auth — JWT login + role protection), 004 (MCP platform), 005 (agent infrastructure), 006 (collector agents — Watchdog alert model), 007 (reasoning agents — Bookkeeper writes KB entries displayed in dashboard), 008 (orchestration — missions routes, mission status), 009 (Telegram bot — proactive delivery model)
- **Required by**: 011 (seed data populates entities visible in the dashboard)


