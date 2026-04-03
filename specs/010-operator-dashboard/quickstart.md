# Quickstart: Operator Dashboard (010)

## Prerequisites

- `uv sync` has been run at the monorepo root
- A running FastAPI instance (feature 001–009 must be deployed or running locally)
- `.env` contains `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and any required API keys
- `config/runtime/dashboard.yaml` exists (created during this feature)

## Start the Dashboard (development)

```bash
uv run python -m dashboard.main
```

The Dash server starts on `http://localhost:8050` by default.

For dev mode with hot reload:

```bash
uv run python -m dashboard.main --debug
```

## Configuration

Edit `config/runtime/dashboard.yaml` to change poll intervals or the API base URL:

```yaml
api_base_url: "http://localhost:8000"
poll_interval_ms: 5000
mission_poll_interval_ms: 10000
auth_bypass_localhost: true
page_size_missions: 20
page_size_kb: 25
touch_target_min_px: 48
```

The app will `sys.exit(1)` with a Pydantic error path if any value is invalid.

## Run Tests

```bash
uv run pytest apps/dashboard/tests/ -v
```

All tests are offline — no running API, no browser, no Docker required.

## Type Check

```bash
uv run mypy --strict apps/dashboard/
```

## Lint

```bash
uv run ruff check apps/dashboard/
```

## Production (Docker)

The dashboard runs as a container defined in `docker-compose.yml`. The
`config/runtime/` directory is mounted read-only:

```bash
docker compose up -d dashboard
```

## Navigate the Dashboard

| URL | Page |
|-----|------|
| `/` | Overview — missions, alerts, agent activity |
| `/missions` | Mission list with status filter |
| `/missions/<id>` | Mission detail — full evidence chain |
| `/watchlist` | Watchlist editor — add / edit / remove items |
| `/kb` | Knowledge base browser — search by entity |
| `/health` | System health — container status for all 10 services |
