# Tasks: Operator Dashboard (010)

**Feature**: 010-operator-dashboard
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Total Tasks**: 38
**Generated**: 2026-04-03

## Notes for Implementors

- **Separate uv workspace package**: The dashboard is `apps/dashboard/` — its own `pyproject.toml`.
  Never imports from `apps/api-service` or any other app directly. All data via HTTP through `ApiClient`.
- **No direct DB access**: The dashboard is a pure HTTP consumer of the FastAPI backend.
- **Offline testing strategy**: Callbacks are split into thin Dash wrappers + pure helper functions.
  Tests import the pure functions directly and mock all HTTP calls via respx. No `dash.testing`,
  no headless browser, no Selenium, no Docker.
- **dcc.Interval polling**: No WebSockets. All live data via `dcc.Interval` triggering callbacks.
  Poll interval is YAML-configurable (`poll_interval_ms`).
- **Token in dcc.Store only**: JWT never sent to browser JS context. All API calls are server-side
  inside Dash callbacks. Token stored only in `dcc.Store(storage_type="session")`.
- **Touch targets**: All buttons, cards, nav links get `min-height: 48px; min-width: 48px` via
  `assets/styles.css`. Use `--touch-target: 48px` CSS custom property.
- **ApiError dataclass**: `api_client.py` methods never raise on HTTP errors — they return a typed
  `ApiError(status_code, message)`. Callers check for this and render error panels.
- **conflict_markers**: `KnowledgeEntry.conflict_markers` is `list[str]` (from Feature 007). The KB
  entry card renders an amber border when this list is non-empty.
- **sys.exit(1)**: `main.py` validates `DashboardConfig` at import time via `model_validate()`.
  Any Pydantic `ValidationError` → print error path → `sys.exit(1)`.

---

## Phase 0: Backend API Surface (Required Before Dashboard UI)

- [X] T034 Create `apps/api-service/src/api/routes/watchlist.py` with list/create/update/delete routes over `WatchlistItemRepository`
- [X] T035 Create `apps/api-service/src/api/routes/alerts.py` with list route and explicit acknowledge action route for operator workflow
- [X] T036 Create `apps/api-service/src/api/routes/knowledge.py` with paginated search/list routes exposing `conflict_markers`, confidence, freshness, and source metadata
- [X] T037 Create `apps/api-service/src/api/routes/dashboard.py` with overview-friendly aggregate endpoint(s) for recent activity and service status
- [X] T038 Register new routers in `apps/api-service/src/api/main.py` and add route tests under `apps/api-service/tests/routes/`

---

## Phase 1: Setup

- [X] T001 Create `apps/dashboard/pyproject.toml` with package name `dashboard`, `[project.dependencies]` including `dash>=2.16`, `plotly`, `httpx`, `pydantic>=2.0`, `pyyaml`, `structlog`; add to `[tool.uv.workspace]` in root `pyproject.toml`
- [X] T002 Create directory skeleton: `apps/dashboard/src/dashboard/__init__.py`, `apps/dashboard/src/dashboard/pages/__init__.py`, `apps/dashboard/src/dashboard/components/__init__.py`
- [X] T003 Ensure `apps/dashboard/tests/` is not packaged as a top-level `tests` module (do not add `__init__.py`) to avoid pytest import path collisions with other app test suites

---

## Phase 2: Foundational

- [X] T004 Create `config/runtime/dashboard.yaml` with: `api_base_url: "http://api:8000"`, `poll_interval_ms: 5000`, `auth_bypass_localhost: true`, `page_size_missions: 20`, `page_size_kb: 10`, `stale_threshold_seconds: 30`
- [X] T005 Create `config/schemas/dashboard.py` with `DashboardConfig(BaseModel)`: `api_base_url: str`, `poll_interval_ms: int = 5000`, `auth_bypass_localhost: bool = True`, `page_size_missions: int = 20`, `page_size_kb: int = 10`, `stale_threshold_seconds: int = 30`; add dashboard-local loader in `apps/dashboard/src/dashboard/config.py` and validate `config/runtime/dashboard.yaml` at dashboard startup (do not add dashboard config to API `AllConfigs`)
- [X] T006 Create `apps/dashboard/src/dashboard/api_client.py` with `ApiClient` class wrapping `httpx.AsyncClient`; methods: `get_missions(status_filter, limit)`, `get_mission(id)`, `get_watchlist()`, `upsert_watchlist_item(data)`, `delete_watchlist_item(id)`, `get_kb_entries(query, page)`, `get_alerts(unacknowledged_only)`, `acknowledge_alert(id)`, `get_health()`; all methods return data dict or `ApiError(status_code: int, message: str)` dataclass — never raise; route paths must match API routes implemented in this feature (`/missions`, `/watchlist`, `/alerts`, `/knowledge`, `/dashboard/health`)
- [X] T007 Create `apps/dashboard/src/dashboard/auth.py` with `get_token(store_data: dict | None, bypass_localhost: bool) -> str`: returns `BYPASS_TOKEN_SENTINEL` when `bypass_localhost=True` and request IP is loopback, returns `MISSING_TOKEN_SENTINEL` when no access token is present, and otherwise returns the JWT from `store_data`; `refresh_if_needed(store_data, api_client)` calls `/auth/refresh` if token expiry within 30 seconds
- [X] T008 Create `apps/dashboard/src/dashboard/assets/styles.css` with CSS custom property `--touch-target: 48px`; rules for `button`, `.card`, `.nav-link`, `.mission-card`, `.alert-badge` setting `min-height: var(--touch-target)` and padding for tap comfort
- [X] T009 Create `apps/dashboard/tests/conftest.py` with: `DashboardConfig` fixture with test values, `respx` router fixture mocking all API endpoints with sample JSON, typed data fixtures (`MissionCardData`, `AlertData`, `WatchlistItemData`, `KbEntryData`, `AgentRunData`) as `dataclass` or `TypedDict`

---

## Phase 3: User Story 1 — Situational Awareness Overview

**Goal**: Primary view shows active missions, unacknowledged alert count, watchlist status, and recent agent activity — all visible without interaction.

**Independent test**: overview callback with respx returning 3 active missions and 2 unacknowledged alerts → rendered layout contains correct counts; respx returning 503 → error panel rendered instead of blank.

- [X] T010 [US1] Create `apps/dashboard/src/dashboard/components/alert_badge.py` with `alert_badge(count: int) -> dash.html.Span`: red badge with count; min-height/min-width 48px; `count=0` renders green badge
- [X] T011 [US1] Create `apps/dashboard/src/dashboard/components/mission_card.py` with `mission_card(data: MissionCardData) -> dash.html.Div`: shows mission type, target ticker, status chip (color-coded), start time, duration; tap target ≥48px; clickable → navigates to `/missions/{id}`
- [X] T012 [US1] Create `apps/dashboard/src/dashboard/pages/overview.py` with Dash Pages layout: mission summary strip (active count, last run time), `alert_badge` component, recent activity feed (last 5 AgentRun records); `dcc.Interval(id="overview-interval", interval=poll_interval_ms)`; callback `update_overview(n_intervals, token_store)` calls `api_client.get_missions()` + `api_client.get_alerts(unacknowledged_only=True)`; returns `dcc.Alert` error panel on `ApiError`
- [X] T013 [US1] Add overview callback tests to `apps/dashboard/tests/test_callbacks.py`: (1) respx returns missions + alerts → correct counts rendered, (2) API returns 503 → error panel rendered (not blank), (3) empty missions list → "No active missions" text shown

---

## Phase 4: User Story 2 — Mission Detail with Evidence Chain

**Goal**: Operator clicks mission → full agent evidence chain shown: ResearchPacket, Assessment, PatternReport, FormattedReport, all agent costs.

**Independent test**: mission detail callback with mock mission data containing 5 AgentRun records → all 5 agent_run_panel components rendered in execution order; in-progress mission → polling interval active.

- [X] T014 [US2] Create `apps/dashboard/src/dashboard/components/agent_run_panel.py` with `agent_run_panel(run: AgentRunData) -> dash.html.Div`: agent name badge, status chip, confidence %, cost_usd ($X.XXXXXX), duration_ms, collapsible JSON output; renders "No output" for agents with no output data
- [X] T015 [US2] Create `apps/dashboard/src/dashboard/pages/missions.py` with: mission list layout (filterable by status via toggle buttons, paginated); row click sets `dcc.Location.pathname = /missions/{id}`; detail sub-layout (loaded when `id` in pathname) shows `mission_card` header + list of `agent_run_panel` for each AgentRun in sequence order; `dcc.Interval` active only when `mission.status == "running"` to refresh in-progress missions
- [X] T016 [US2] Add mission callbacks to `apps/dashboard/tests/test_callbacks.py`: (1) list filtered by status=COMPLETED → only completed missions returned, (2) detail view shows all agent runs in order, (3) in-progress mission → interval component is active, (4) completed mission → interval component is disabled

---

## Phase 5: User Story 3 — Watchlist Management

**Goal**: Operator adds, edits, disables, removes watchlist items from the dashboard without touching config files.

**Independent test**: watchlist form save callback → `upsert_watchlist_item` API call with correct payload; delete callback → `delete_watchlist_item` called; toggle active → PATCH `/watchlist/{id}` with `{"active": false}`.

- [X] T017 [US3] Create `apps/dashboard/src/dashboard/components/watchlist_form.py` with `watchlist_form(item: WatchlistItemData | None) -> dash.html.Div`: form fields for ticker, name, sector, list_type (dropdown), active (toggle), price_change_threshold (number input), volume_spike_threshold (number input); all inputs ≥48px tap target; pre-filled when `item` is not None (edit mode); empty when None (add mode)
- [X] T018 [US3] Create `apps/dashboard/src/dashboard/pages/watchlist.py` with: table of watchlist items (ticker, name, sector, list_type, active status, thresholds); "Add Item" button opens `watchlist_form` modal; save callback calls `api_client.upsert_watchlist_item()`; delete callback calls `api_client.delete_watchlist_item()`; active toggle triggers PATCH; table refreshed by `dcc.Interval`
- [X] T019 [US3] Add watchlist callbacks to `apps/dashboard/tests/test_callbacks.py`: (1) save new item → POST called with correct payload, (2) edit existing → PUT called, (3) delete → DELETE called → item removed from table, (4) toggle active → PATCH with `{"active": false}`

---

## Phase 6: User Story 4 — Knowledge Base Browser

**Goal**: Operator searches KB by entity name, sees entries with content, confidence, freshness, source agent, and conflict indicators.

**Independent test**: KB search callback with query "AAPL" → respx returns 3 entries (one with non-empty `conflict_markers`) → 3 `kb_entry_card` components rendered; entry with conflict → amber border CSS class applied.

- [X] T020 [US4] Create `apps/dashboard/src/dashboard/components/kb_entry_card.py` with `kb_entry_card(entry: KbEntryData) -> dash.html.Div`: content preview (first 300 chars + expand button), confidence % chip, freshness (updated_at relative), source_agent label, topic/entity_name tags; renders amber border CSS class when `entry.conflict_markers` is non-empty list; renders conflict marker strings as warning labels
- [X] T021 [US4] Create `apps/dashboard/src/dashboard/pages/kb.py` with: search input + "Search" button; callback calls `api_client.get_kb_entries(query=input_value, page=current_page)`; results rendered as list of `kb_entry_card`; pagination controls (prev/next); `page_size_kb` from config
- [X] T022 [US4] Add KB callbacks to `apps/dashboard/tests/test_callbacks.py`: (1) search returns results → cards rendered, (2) entry with conflict_markers → amber border class applied, (3) empty results → "No entries found" message, (4) API error → error panel

---

## Phase 7: User Story 5 — Touchscreen Usability

**Goal**: All interactive elements have ≥48px touch targets; tap actions work without hover states.

**Independent test**: CSS audit — all interactive component functions produce HTML elements with inline styles or CSS classes that resolve to `min-height: 48px`; no hover-only interactions exist in component code.

- [X] T023 [US5] Create `apps/dashboard/src/dashboard/components/health_indicator.py` with `health_indicator(service: str, status: str) -> dash.html.Div`: green/amber/red dot + service label; `min-height: var(--touch-target)`; clickable (navigates to `/health` detail)
- [X] T024 [US5] Create `apps/dashboard/src/dashboard/pages/health.py` with: grid of `health_indicator` for all Docker services (api, celery-beat, worker-mission, worker-alert, worker-screener, worker-watchdog, worker-brief, telegram-bot, telegram-worker, dashboard); last refresh timestamp; `dcc.Interval` at `poll_interval_ms`; stale data (last_updated > `stale_threshold_seconds`) renders amber "Stale" badge on all indicators
- [X] T025 [US5] Add touch target assertion tests to `apps/dashboard/tests/test_callbacks.py`: verify `mission_card()` HTML output contains style or class with min-height reference; verify `watchlist_form()` all inputs have tap-sized wrappers; verify health indicator renders correct status colors

---

## Phase 8: Application Entry Point

- [X] T026 Create `apps/dashboard/src/dashboard/main.py` with: `DashboardConfig.model_validate(yaml.safe_load(...))` at module level + `sys.exit(1)` on `ValidationError` with Pydantic error path; `dash.Dash(__name__, use_pages=True)` with `dcc.Location`, `dcc.Store(id="auth-store", storage_type="session")`, `dcc.Interval(id="global-interval")`, navbar with links to all pages, `dash.page_container`; `server = app.server` for production WSGI
- [X] T027 Extend `docker-compose.yml` (root level) to add `dashboard` service: build context `./apps/dashboard`, command `python -m dashboard.main`, port `8050:8050`, depends_on api
- [X] T028 Add `DASHBOARD_API_URL` and `DASHBOARD_AUTH_BYPASS_LOCALHOST` to `.env.example` with placeholder values and comments

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T029 Export all component functions from `apps/dashboard/src/dashboard/components/__init__.py`
- [X] T030 Export all page module `layout` variables from `apps/dashboard/src/dashboard/pages/__init__.py`
- [X] T031 Run `uv run mypy --strict apps/dashboard/src/` — zero errors required
- [X] T032 Run `uv run ruff check apps/dashboard/src/` — zero warnings required
- [X] T033 Run `uv run pytest apps/dashboard/tests/ -v` — all tests must pass offline without browser, Docker, or network access

---

## Dependency Graph

```
Phase 0 (T034–T038) → Phase 1 (T001–T003) → Phase 2 (T004–T009) → Phase 3 US1 (T010–T013)
                                           → Phase 4 US2 (T014–T016)  [after Phase 2]
                                           → Phase 5 US3 (T017–T019)  [after Phase 2]
                                           → Phase 6 US4 (T020–T022)  [after Phase 2]
                                           → Phase 7 US5 (T023–T025)  [after Phase 2]
All story phases → Phase 8 (T026–T028) → Phase 9 (T029–T033)
```

**External dependencies (must be complete before starting this feature)**:
- Feature 002: `KnowledgeEntry.conflict_markers: list[str]`, `WatchlistItem` thresholds schema
- Feature 003: `/auth/refresh`, `/operators`, role-based auth endpoints
- Feature 006: Alert persistence and mission linkage model
- Feature 007: `AgentRun` records with cost/token/model fields; `KnowledgeEntry` format
- Feature 008: `/missions`, `/missions/{id}` API endpoints with AgentRun sub-resources

---

## Parallel Execution Opportunities

Within Phase 2: T004 and T005 can run in parallel with T007 and T008 (different files, no deps).

Within Phase 3–7 (after Phase 2 complete): All 5 user story phases are independent and can run fully in parallel — they work on different pages/components.

Phase 7 (US5) touch target tests can run in parallel with Phase 3–6 callback tests.

---

## Implementation Strategy

**MVP scope** (US1 + US2): Implement T034–T016. This delivers required API surface plus situational awareness overview and mission detail with evidence chain — the two P1 stories. US3 (watchlist), US4 (KB), US5 (touch) follow.

**Incremental delivery**:
1. T034–T038: API surface completion in api-service
2. T001–T009: Package, config, API client, auth, CSS foundation, test fixtures
3. T010–T013: Overview page working with mocked API
4. T014–T016: Mission detail with evidence chain
5. T017–T025: Watchlist editor, KB browser, touch audit
6. T026–T033: Entry point, docker-compose, quality gate




