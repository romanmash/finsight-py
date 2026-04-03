# Implementation Plan: Foundation & Config

**Branch**: `001-python-foundation-config` | **Date**: 2026-04-02 | **Spec**: [specs/001-python-foundation-config/spec.md](../spec.md)

## Summary

This feature establishes the complete monorepo skeleton: uv workspace configuration for all
six packages, Pydantic v2 config schemas for every YAML runtime file, a fail-fast config loader
that calls `sys.exit(1)` on any validation error, Docker Compose for all services, Alembic
migration scaffolding, and offline pytest infrastructure. Every subsequent feature depends on
this foundation being correct.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: pydantic>=2.7, pydantic-settings>=2.3, pyyaml>=6.0, structlog>=24.1, alembic>=1.13, sqlalchemy[asyncio]>=2.0, asyncpg>=0.29, croniter>=1.4, pytest>=8.2, pytest-asyncio>=0.23, mypy>=1.10, ruff>=0.4
**Storage**: PostgreSQL 16 + pgvector (via Docker); Redis 7 (via Docker)
**Testing**: pytest + pytest-asyncio (offline, no Docker required)
**Target Platform**: Linux server (Docker) / Windows 11 dev (Podman)
**Project Type**: Python monorepo — workspace root + 6 sub-packages
**Performance Goals**: API startup < 5 seconds; config validation abort < 1 second
**Constraints**: mypy --strict zero errors; ruff zero warnings; all tests offline
**Scale/Scope**: Foundation only — no business logic in this feature

## Constitution Check

- [x] Everything-as-Code — all config in `config/runtime/*.yaml` validated by Pydantic v2; no hardcoded values
- [x] Agent Boundaries — N/A (no agents in this feature)
- [x] MCP Server Independence — N/A (MCP servers get `pyproject.toml` stubs only)
- [x] Cost Observability — N/A (no LLM calls in this feature)
- [x] Fail-Safe Defaults — `sys.exit(1)` with precise error on any YAML validation failure
- [x] Test-First — config loading tests use `monkeypatch` + `tmp_path`; all offline
- [x] Simplicity Over Cleverness — no custom config framework; pure Pydantic v2 + PyYAML

## Project Structure

### Documentation (this feature)

```text
specs/001-python-foundation-config/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md  (created by /speckit.tasks)
```

### Source Code

```text
# Root workspace
pyproject.toml                                    # uv workspace root; mypy + ruff config
.python-version                                   # "3.13"
.env.example                                      # all required env vars documented
alembic.ini                                       # points to apps/api/alembic/
docker-compose.yml                                # all ~10 services
docker-compose.dev.yml                            # volume mounts for live reload
conftest.py                                       # root pytest config (asyncio_mode=auto)
pytest.ini  (or pyproject.toml [tool.pytest])     # test discovery, asyncio_mode

# Shared domain models package (zero external deps)
packages/shared/
├── pyproject.toml
└── src/finsight/shared/
    ├── __init__.py
    └── types.py                                  # common type aliases (ID, Timestamp, etc.)

# API application
apps/api/
├── pyproject.toml
├── alembic/
│   ├── env.py                                    # async migration runner
│   └── versions/                                 # empty; Feature 002 adds 001_initial_schema.py
└── src/api/
    ├── __init__.py
    └── lib/
        ├── config.py                             # Settings (BaseSettings) + load_all_configs()
        └── logging.py                            # structlog configuration

# MCP server stubs
apps/mcp-servers/market-data/pyproject.toml
apps/mcp-servers/news-macro/pyproject.toml
apps/mcp-servers/rag-retrieval/pyproject.toml

# Dashboard stub
apps/dashboard/pyproject.toml

# Telegram bot stub
apps/telegram-bot/pyproject.toml

# Runtime config (YAML files)
config/runtime/
├── agents.yaml
├── mcp.yaml
├── pricing.yaml
├── watchdog.yaml
└── scheduler.yaml

# Config schemas (Pydantic v2 BaseModel)
config/schemas/
├── __init__.py
├── agents.py
├── mcp.py
├── pricing.py
├── watchdog.py
└── scheduler.py

# Tests
apps/api/tests/
├── __init__.py
└── test_config.py                                # config load, fail-fast, env injection
```

## Implementation Phases

### Phase 1: Workspace Root & pyproject.toml Files

**Files**:
- `pyproject.toml` — uv workspace root; declares all members; configures mypy `--strict`, ruff rules, pytest `asyncio_mode = "auto"`
- `.python-version` — contains `3.13`
- `packages/shared/pyproject.toml` — package name `finsight-shared`; no external dependencies; exports `finsight.shared`
- `apps/api/pyproject.toml` — package name `finsight-api`; depends on `finsight-shared`; lists all API deps
- `apps/mcp-servers/market-data/pyproject.toml` — package name `finsight-mcp-market-data`; stub for now
- `apps/mcp-servers/news-macro/pyproject.toml` — package name `finsight-mcp-news-macro`; stub
- `apps/mcp-servers/rag-retrieval/pyproject.toml` — package name `finsight-mcp-rag-retrieval`; stub
- `apps/dashboard/pyproject.toml` — package name `finsight-dashboard`; stub
- `apps/telegram-bot/pyproject.toml` — package name `finsight-telegram-bot`; stub

**Key decisions**:
- Each package uses `src/` layout with `[tool.setuptools.packages.find] where = ["src"]` (or equivalent uv/hatch setting)
- The root `pyproject.toml` does NOT list business dependencies — only workspace + tooling config
- All dev dependencies (mypy, ruff, pytest, etc.) are declared in the root `[dependency-groups]`

### Phase 2: Shared Package Base Types

**Files**:
- `packages/shared/src/finsight/shared/__init__.py` — exports `__version__ = "0.1.0"` and public symbols
- `packages/shared/src/finsight/shared/types.py` — type aliases: `AgentName = str`, `MissionID = UUID`, `Timestamp = datetime`, `CostUSD = Decimal`; all exported

**Key decisions**:
- `packages/shared` has zero external dependencies — only Python stdlib
- All domain type aliases defined here are imported by both `apps/api` and config schemas
- No Pydantic models in this file — those come in Feature 002

### Phase 3: Config YAML Files + Pydantic Schemas

**Files**:
- `config/runtime/agents.yaml` — defines all 7 agents with model, provider, temperature, max_tokens, max_retries, timeout_seconds
- `config/runtime/mcp.yaml` — defines 3 MCP servers with url, timeout_seconds, cache_ttl_seconds
- `config/runtime/pricing.yaml` — model cost map; includes at least `openai/gpt-4o`, `openai/gpt-4o-mini`, `anthropic/claude-3-5-sonnet`
- `config/runtime/watchdog.yaml` — poll_interval_seconds, alert_cooldown_seconds, default_thresholds
- `config/runtime/scheduler.yaml` — screener_cron, brief_cron, earnings_lookback_days, timezone
- `config/schemas/__init__.py` — empty
- `config/schemas/agents.py` — `AgentConfig` + `AgentsConfig`; all fields typed; validators for temperature range
- `config/schemas/mcp.py` — `McpServerConfig` + `McpConfig`
- `config/schemas/pricing.py` — `ModelPricing` + `PricingConfig`; `get_cost()` method returns `(0.0, warning_logged)` for unknown models
- `config/schemas/watchdog.py` — `ThresholdDefaults` + `WatchdogConfig`
- `config/schemas/scheduler.py` — `SchedulerConfig`; validates cron expressions with `croniter`

**Key decisions**:
- All YAML values use snake_case matching the Pydantic field names exactly — no aliasing needed
- `model_config = ConfigDict(frozen=True)` on all schema models — immutable at runtime
- `PricingConfig.get_cost(provider, model)` handles unknown models gracefully with a structlog warning

### Phase 4: Settings + Config Loader

**Files**:
- `apps/api/src/api/__init__.py` — empty
- `apps/api/src/api/lib/config.py` — contains:
  - `Settings(BaseSettings)` — all secrets/env vars; `model_config = SettingsConfigDict(env_file=".env", extra="ignore")`
  - `load_yaml_config(path, model)` — loads + validates one YAML file; calls `sys.exit(1)` on `ValidationError` or `YAMLError`
  - `load_all_configs()` — loads all 5 YAML files; returns a `AllConfigs` dataclass holding each schema instance
  - `get_settings()` — cached singleton returning `Settings()`
- `apps/api/src/api/lib/logging.py` — `configure_logging(level)` sets up structlog with JSON renderer

**Key decisions**:
- `load_all_configs()` is called once at FastAPI lifespan startup, not at import time (avoids issues in test environments)
- `get_settings()` uses `functools.lru_cache` so the `.env` file is read once
- Error messages from `sys.exit(1)` include: filename, Pydantic error location (field path), and the violation description

### Phase 5: Alembic Setup

**Files**:
- `alembic.ini` — `script_location = apps/api/alembic`; `sqlalchemy.url` left as placeholder (overridden in `env.py`)
- `apps/api/alembic/env.py` — async migration runner; reads `DATABASE_URL` from environment; imports `Base.metadata` (Feature 002 will populate it)
- `apps/api/alembic/versions/` — empty directory; first migration added by Feature 002

**Key decisions**:
- `env.py` uses `asyncio.run(run_async_migrations())` pattern for SQLAlchemy async engine compatibility
- `Base.metadata` import is guarded with a try/except so Alembic can run before ORM models exist

### Phase 6: Docker Compose

**Files**:
- `docker-compose.yml` — services:
  - `db`: `pgvector/pgvector:pg16`; port 5432; healthcheck; volume `pgdata`
  - `redis`: `redis:7-alpine`; port 6379; healthcheck
  - `api`: builds from `apps/api/`; port 8000; depends on `db`, `redis`; env from `.env`
  - `market-data-mcp`: builds from `apps/mcp-servers/market-data/`; port 8001
  - `news-macro-mcp`: builds from `apps/mcp-servers/news-macro/`; port 8002
  - `rag-retrieval-mcp`: builds from `apps/mcp-servers/rag-retrieval/`; port 8003
  - `dashboard`: builds from `apps/dashboard/`; port 8050
  - `telegram-bot`: builds from `apps/telegram-bot/`; no exposed port
  - `worker-watchdog`: same image as `api`; command `celery -A api.workers worker -Q watchdog`
  - `worker-brief`: same image as `api`; command `celery -A api.workers worker -Q brief`
- `docker-compose.dev.yml` — override: volume-mounts source dirs; `RELOAD=true` for API

**Key decisions**:
- All containers read secrets from `.env` via `env_file: .env` — never baked into image
- `config/runtime/` is mounted `:ro` in all containers that read config
- Container images use multi-stage builds: builder stage installs deps with `uv`, final stage copies installed packages

### Phase 7: .env.example

**Files**:
- `.env.example` — documents every required environment variable with description, placeholder, and whether it is required or optional

**Variables documented**:
```
DATABASE_URL=postgresql+asyncpg://finsight:changeme@localhost:5432/finsight
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...  # optional
FINNHUB_API_KEY=...            # optional
TELEGRAM_BOT_TOKEN=...         # optional
SECRET_KEY=change-this-to-a-random-32-char-string
ENVIRONMENT=dev
LOG_LEVEL=INFO
LANGCHAIN_TRACING_V2=false         # set to true to enable LangSmith tracing
LANGCHAIN_API_KEY=                 # optional — required only when LANGCHAIN_TRACING_V2=true
```

### Phase 8: Test Infrastructure

**Files**:
- `conftest.py` (root) — sets `asyncio_mode = "auto"` in `pytest.ini_options`; shared fixtures: `tmp_config_dir` (creates temp YAML files), `mock_env` (monkeypatches env vars)
- `apps/api/tests/__init__.py` — empty
- `apps/api/tests/test_config.py` — tests:
  - `test_valid_config_loads` — writes valid YAML to tmp dir, loads it, asserts model fields
  - `test_invalid_yaml_type_exits` — writes YAML with wrong type, asserts `SystemExit` raised
  - `test_missing_required_field_exits` — omits required field, asserts `SystemExit`
  - `test_unparseable_yaml_exits` — writes malformed YAML, asserts `SystemExit`
  - `test_settings_loads_from_env` — monkeypatches env vars, calls `get_settings()`, asserts values
  - `test_extra_env_vars_ignored` — adds unknown env var, asserts no error
  - `test_unknown_pricing_model_returns_zero` — calls `get_cost()` with unknown model, asserts 0.0

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| YAML validation | Pydantic v2 `BaseModel` | In locked stack; rich error messages; `frozen=True` prevents runtime mutation |
| Secret isolation | `pydantic-settings` `BaseSettings` | Strict separation of secrets (env) from config (YAML) |
| Fail-fast mechanism | `sys.exit(1)` with error string | Explicit, immediate, no exception swallowed |
| Logging | structlog JSON | Locked stack; machine-readable; structured context |
| Unknown pricing | Return 0.0 + warn | Never block startup over missing pricing data |
| Test fixtures | `tmp_path` + `monkeypatch` | No file system pollution; no env leakage between tests |
| Workspace layout | src/ layout per package | Prevents accidental imports of test files; standard Python packaging |
| Cron validation | `croniter` | Lightweight; validates cron strings at config load time, not at schedule time |

## Testing Strategy

- All tests use `pytest` with `asyncio_mode = "auto"` — no explicit `@pytest.mark.asyncio`
- Config tests write YAML to `tmp_path` via fixtures — no real `config/runtime/` files accessed
- Settings tests use `monkeypatch.setenv` — no real `.env` file read during tests
- `sys.exit(1)` calls are caught by `pytest.raises(SystemExit)` — assert exit code and message
- No network calls, no Docker, no database connections in any test in this feature
- `mypy --strict` run as part of CI (also runnable locally with `uv run mypy --strict`)

## Dependencies

- **Requires**: none (this is the foundation)
- **Required by**: 002-async-data-layer, 003-api-jwt-auth, and all subsequent features
