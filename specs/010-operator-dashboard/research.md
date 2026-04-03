# Research: Operator Dashboard (010)

## Dash vs. Other Python Dashboard Frameworks

**Chosen**: Dash (Plotly) 2.x
**Rationale**: Locked by the technology stack. Dash is Python-native, renders as a React SPA, and
supports callback-driven interactivity without any JavaScript. It pairs naturally with the
existing Python monorepo and `uv` workspaces.
**Alternatives considered**: Streamlit (too opinionated for multi-page layouts, no fine-grained
touch control), Panel (heavier dependency tree), raw FastAPI + HTMX (requires HTML/JS authoring
outside Python).

## Polling vs. WebSockets

**Chosen**: `dcc.Interval` polling (5-second default, configurable via `dashboard.yaml`)
**Rationale**: The constitution explicitly forbids WebSocket complexity. `dcc.Interval` is the
idiomatic Dash approach for live data; it is stateless on the server side, requires no
connection management, and is trivially testable by firing interval events in pytest.
**Alternatives considered**: `dcc.WebSocket` component (third-party, experimental, violates
constitution), Server-Sent Events (requires custom Dash component or monkey-patching Flask).

## Authentication Strategy

**Chosen**: JWT stored in `dcc.Store` (browser session storage), refreshed via `/auth/refresh`
before each major data fetch; unauthenticated on localhost (configurable bypass flag in
`dashboard.yaml`)
**Rationale**: The spec states no login is required when accessed from the local machine. A
config-driven bypass keeps local usage friction-free while allowing the same code to enforce JWT
on any remote access. The token is kept only in Dash server-side session state — never in
`localStorage`.
**Alternatives considered**: Cookie-based session (requires Flask session config, leaks between
browser tabs), OAuth2 device flow (overkill for single-operator console).

## Multi-page Layout

**Chosen**: Dash Pages (`dash.page_registry`) with a top-level `dcc.Location` router
**Rationale**: Dash Pages is the official multi-page pattern since Dash 2.5. It avoids manual URL
routing and integrates with the `dcc.Location` component for deep-linking to mission detail views
(`/missions/<id>`).
**Alternatives considered**: Single-page tab layout (`dcc.Tabs`) — makes deep-linking to mission
details impossible; URL would not survive a browser refresh.

## HTTP Client for API Calls

**Chosen**: `httpx` with a shared `AsyncClient` instance, wrapped in `api_client.py`
**Rationale**: `httpx` is already a project dependency (used by the FastAPI test client). Async
client matches the Dash callback executor model. All API calls are made server-side inside
callbacks, so the browser never holds tokens.
**Alternatives considered**: `requests` (sync, blocks the Dash worker thread), `aiohttp` (no
additional benefit over `httpx` given existing dependency).

## Touch Target Sizing

**Chosen**: CSS custom properties in a `assets/styles.css` file: min `touch-target` = 48×48 px,
font-size ≥ 16 px for all interactive labels, `user-select: none` on tap targets
**Rationale**: WCAG 2.5.5 recommends 44×44 px minimum; 48 px leaves margin for the specific
laptop touchscreen. Implemented via Dash `style` dicts and a global stylesheet in `assets/`.
**Alternatives considered**: A full Dash Bootstrap Components (DBC) theme — DBC is acceptable but
adds a heavy dependency. Plain Dash with targeted CSS is sufficient for an operator console.

## Offline Testing of Callbacks

**Chosen**: Dash `testing` module (`dash.testing.composite.DashComposite`) is NOT used (requires
a browser/selenium). Instead, callbacks are extracted as pure functions and tested directly with
`pytest` by calling the underlying Python logic with mock return values from `httpx`.
**Rationale**: The constitution requires all tests to pass offline without Docker. Browser-based
Dash tests (`dash.testing`) require Chrome/ChromeDriver. Pure-function callback testing with
`respx` for HTTP mocking satisfies the offline constraint.
**Alternatives considered**: `dash.testing` with headless Chrome (requires Docker or CI browser
install), Playwright (same issue).

## Config Schema

**Chosen**: Pydantic v2 `BaseSettings` class in `config/schemas/dashboard.py`, loading values
from `config/runtime/dashboard.yaml` at Dash app startup; `sys.exit(1)` on validation failure
**Rationale**: Consistent with the constitution's fail-fast config requirement. The same pattern
is used across all other apps in the monorepo.
**Alternatives considered**: Plain `yaml.safe_load` dict access (no type safety, no early
failure).
