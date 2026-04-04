# Tasks: Foundation & Config

**Input**: Design documents from `/specs/001-python-foundation-config/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | research.md ✅ | quickstart.md ✅
**Total Tasks**: 36

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3], [US4])
- Exact file paths are included in every description

---

## Phase 1: Setup (Workspace Skeleton)

**Purpose**: Create the complete monorepo directory structure and all `pyproject.toml` files so
every subsequent task has a valid Python package to write into. Nothing compiles or runs here —
just scaffolding.

- [x] T001 Create root `pyproject.toml` with uv workspace declaration, all member paths, mypy --strict config, ruff rules (E, F, I, UP, B, SIM), and pytest asyncio_mode = "auto" in `pyproject.toml`
- [x] T002 [P] Create `.python-version` containing `3.13` in `.python-version`
- [x] T003 [P] Create `packages/shared/pyproject.toml` declaring package `finsight-shared` with src layout and zero external dependencies in `packages/shared/pyproject.toml`
- [x] T004 [P] Create `apps/api-service/pyproject.toml` declaring package `finsight-api` with all API dependencies: pydantic>=2.7, pydantic-settings>=2.3, pyyaml>=6.0, structlog>=24.1, alembic>=1.13, sqlalchemy[asyncio]>=2.0, asyncpg>=0.29, croniter>=1.4, fastapi, uvicorn[standard] in `apps/api-service/pyproject.toml`
- [x] T005 [P] Create stub `pyproject.toml` files for all remaining packages: `apps/mcp-servers/market-data/pyproject.toml`, `apps/mcp-servers/news-macro/pyproject.toml`, `apps/mcp-servers/rag-retrieval/pyproject.toml`, `apps/dashboard/pyproject.toml`, `apps/telegram-bot/pyproject.toml` — each with correct package name and minimal metadata
- [x] T006 [P] Create all `__init__.py` files to make packages importable: `packages/shared/src/finsight/shared/__init__.py`, `apps/api-service/src/api/__init__.py`, `apps/api-service/src/api/lib/__init__.py`, `apps/api-service/src/api/routes/__init__.py`, `config/schemas/__init__.py`
- [x] T007 [P] Create root `conftest.py` with `asyncio_mode = "auto"` in `pytest.ini_options` and shared fixtures: `tmp_config_dir` (creates temp YAML via `tmp_path`), `mock_env` (monkeypatches env vars) in `conftest.py`
- [x] T008 [P] Create `apps/api-service/tests/__init__.py` (empty) in `apps/api-service/tests/__init__.py`

**Checkpoint**: All package directories exist; `uv sync` completes without errors; no implementation yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared domain types and all Pydantic config schemas that user stories depend on.
All YAML files and their schemas must exist before the config loader (US1/US2) or tests (US3)
can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T009 Create `packages/shared/src/finsight/shared/types.py` with domain type aliases: `AgentName = str`, `MissionID = UUID`, `Timestamp = datetime`, `CostUSD = Decimal` — all exported from `__init__.py` in `packages/shared/src/finsight/shared/types.py`
- [x] T010 [P] Create `config/runtime/agents.yaml` with all 9 agent definitions (manager, watchdog, screener, researcher, analyst, technician, bookkeeper, reporter, trader) — each with model, provider, temperature, max_tokens, max_retries, timeout_seconds, base_url fields in `config/runtime/agents.yaml`
- [x] T011 [P] Create `config/schemas/agents.py` with `AgentConfig` (all fields typed, temperature validator 0.0–2.0, `base_url: str | None = None`) and `AgentsConfig(agents: dict[str, AgentConfig])` — `model_config = ConfigDict(frozen=True)` on both in `config/schemas/agents.py`
- [x] T012 [P] Create `config/runtime/mcp.yaml` with 3 MCP server entries (market-data, news-macro, rag-retrieval) each with url, timeout_seconds, cache_ttl_seconds in `config/runtime/mcp.yaml`
- [x] T013 [P] Create `config/schemas/mcp.py` with `McpServerConfig(url, timeout_seconds, cache_ttl_seconds)` and `McpConfig(servers: dict[str, McpServerConfig])` — `frozen=True` in `config/schemas/mcp.py`
- [x] T014 [P] Create `config/runtime/pricing.yaml` with model cost map including at minimum `openai/gpt-4o`, `openai/gpt-4o-mini`, `anthropic/claude-3-5-sonnet` (input_cost_per_1k, output_cost_per_1k) in `config/runtime/pricing.yaml`
- [x] T015 [P] Create `config/schemas/pricing.py` with `ModelPricing(input_cost_per_1k, output_cost_per_1k)`, `PricingConfig(models: dict[str, ModelPricing])`, and `get_cost(provider, model) -> tuple[float, float]` returning `(0.0, 0.0)` with structlog warning for unknown models — `frozen=True` in `config/schemas/pricing.py`
- [x] T016 [P] Create `config/runtime/watchdog.yaml` with poll_interval_seconds, alert_cooldown_seconds, default_thresholds (price_change_pct, volume_spike_multiplier, rsi_overbought) in `config/runtime/watchdog.yaml`
- [x] T017 [P] Create `config/schemas/watchdog.py` with `ThresholdDefaults` and `WatchdogConfig` — `frozen=True` in `config/schemas/watchdog.py`
- [x] T018 [P] Create `config/runtime/scheduler.yaml` with screener_cron, brief_cron, earnings_lookback_days, timezone in `config/runtime/scheduler.yaml`
- [x] T019 [P] Create `config/schemas/scheduler.py` with `SchedulerConfig` — validate cron expressions using `croniter.is_valid()`, raise `ValueError` on invalid cron so Pydantic rejects it — `frozen=True` in `config/schemas/scheduler.py`
- [x] T020 [P] Create `apps/api-service/src/api/lib/logging.py` with `configure_logging(level: str) -> None` that sets up structlog with JSON renderer and ISO timestamps in `apps/api-service/src/api/lib/logging.py`

**Checkpoint**: All YAML + schema pairs exist; `from config.schemas.agents import AgentsConfig` works; mypy --strict passes on all schema files.

---

## Phase 3: User Story 1 — Project Boots from Scratch (Priority: P1) 🎯 MVP

**Goal**: The complete config loading system: `Settings` (env vars), `load_yaml_config()` (single-file loader with fail-fast), `load_all_configs()` (loads all 5 YAML files and returns `AllConfigs`), and `get_settings()` (cached singleton).

**Independent Test**: `uv run pytest apps/api-service/tests/test_config.py::test_valid_config_loads` passes; `test_settings_loads_from_env` passes.

- [x] T021 [US1] Create `apps/api-service/src/api/lib/config.py` with:
  - `Settings(BaseSettings)` — all fields from data-model.md; `model_config = SettingsConfigDict(env_file=".env", extra="ignore")`
  - `AllConfigs` dataclass with fields: `agents: AgentsConfig`, `mcp: McpConfig`, `pricing: PricingConfig`, `watchdog: WatchdogConfig`, `scheduler: SchedulerConfig`
  - `load_yaml_config(path: Path, model: type[T]) -> T` — loads YAML, validates against model, calls `sys.exit(1)` with filename + Pydantic error path + violation description on `ValidationError` or `yaml.YAMLError`
  - `load_all_configs(config_dir: Path = Path("config/runtime")) -> AllConfigs` — loads all 5 YAML files; returns `AllConfigs`
  - `get_settings() -> Settings` — `functools.lru_cache` singleton
  in `apps/api-service/src/api/lib/config.py`
- [x] T022 [US1] Write `apps/api-service/tests/test_config.py` with all 7 tests from the plan:
  - `test_valid_config_loads` — writes valid YAML to `tmp_path`, calls `load_yaml_config`, asserts fields
  - `test_invalid_yaml_type_exits` — wrong type → asserts `SystemExit`
  - `test_missing_required_field_exits` — omitted required field → asserts `SystemExit`
  - `test_unparseable_yaml_exits` — malformed YAML → asserts `SystemExit`
  - `test_settings_loads_from_env` — monkeypatches env vars, calls `get_settings()`, asserts values
  - `test_extra_env_vars_ignored` — extra unknown env var → no error
  - `test_unknown_pricing_model_returns_zero` — calls `PricingConfig.get_cost()` with unknown model → asserts (0.0, 0.0)
  in `apps/api-service/tests/test_config.py`

**Checkpoint**: `uv run pytest apps/api-service/tests/test_config.py` — all 7 tests pass offline.

---

## Phase 4: User Story 2 — Invalid Config Fails Fast (Priority: P1)

**Goal**: The fail-fast mechanism is already embedded in `load_yaml_config()` from Phase 3.
This phase verifies all four failure modes are tested and the `sys.exit(1)` messages contain
actionable information (filename + field path + violation).

**Independent Test**: `uv run pytest apps/api-service/tests/test_config.py -k "exits"` — all sys.exit tests pass.

*Note*: The core implementation lives in `load_yaml_config()` (T021). This phase adds the
`.env.example` file and validates the error message quality.

- [x] T023 [US2] Create `.env.example` documenting every required environment variable with description and placeholder: DATABASE_URL, REDIS_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY (optional), FINNHUB_API_KEY (optional), TELEGRAM_BOT_TOKEN (optional), SECRET_KEY, ENVIRONMENT, LOG_LEVEL, LANGCHAIN_TRACING_V2, LANGCHAIN_API_KEY (optional) in `.env.example`
- [x] T024 [US2] Verify `sys.exit(1)` error messages in `test_config.py` contain all three parts — filename, Pydantic field path (e.g. `agents.manager.temperature`), and violation description — by asserting on `SystemExit.args[0]` or captured stderr; update assertions in existing tests if messages are not yet specific enough in `apps/api-service/tests/test_config.py`

**Checkpoint**: All sys.exit tests pass; error messages contain filename + field path + violation text.

---

## Phase 5: User Story 3 — Developer Runs the Full Test Suite Offline (Priority: P2)

**Goal**: Complete pytest infrastructure: root `conftest.py` fixtures fully operational, `asyncio_mode=auto` confirmed, all existing tests run offline.

**Independent Test**: Disconnect network, run `uv run pytest` — all tests pass with no external calls.

- [x] T025 [US3] Expand root `conftest.py` fixtures to cover all YAML config types: `agents_yaml_fixture`, `mcp_yaml_fixture`, `pricing_yaml_fixture`, `watchdog_yaml_fixture`, `scheduler_yaml_fixture` — each returns a valid dict for that schema, written to `tmp_path`, usable across feature test suites in `conftest.py`
- [x] T026 [P] [US3] Add `pytest` and `pytest-asyncio` to root `pyproject.toml` `[dependency-groups.dev]` alongside mypy, ruff — confirm `asyncio_mode = "auto"` is in `[tool.pytest.ini_options]` in `pyproject.toml`
- [x] T027 [P] [US3] Run `uv run mypy --strict apps/api-service/src config/schemas packages/shared/src` and fix any type errors until zero errors remain (document any `type: ignore` with justification inline) in `apps/api-service/src/api/lib/config.py`, `config/schemas/*.py`, `packages/shared/src/finsight/shared/types.py`
- [x] T028 [P] [US3] Run `uv run ruff check` and fix all warnings; run `uv run ruff format` to ensure consistent formatting across all Python files created so far in all `.py` files in the feature

**Checkpoint**: `uv run pytest` passes; `uv run mypy --strict` passes; `uv run ruff check` passes — all offline.

---

## Phase 6: User Story 4 — Developer Starts Local Infrastructure with One Command (Priority: P2)

**Goal**: `docker-compose.yml` that brings up the core platform services (8 services in Feature 001); `docker-compose.dev.yml` override for live reload; Alembic scaffolding ready for Feature 002's first migration.

**Independent Test**: `docker compose up -d` → all services healthy; `docker compose ps` shows all green.

- [x] T029 [US4] Create `docker-compose.yml` with all services:
  - `db`: `pgvector/pgvector:pg16`, port 5432, healthcheck (`pg_isready`), named volume `pgdata`
  - `redis`: `redis:7-alpine`, port 6379, healthcheck (`redis-cli ping`)
  - `api`: builds from `apps/api-service/`, port 8000, depends_on db+redis, env_file `.env`
  - `market-data-mcp`: builds from `apps/mcp-servers/market-data/`, port 8001
  - `news-macro-mcp`: builds from `apps/mcp-servers/news-macro/`, port 8002
  - `rag-retrieval-mcp`: builds from `apps/mcp-servers/rag-retrieval/`, port 8003
  - `worker-watchdog`: same image as api, command `celery -A api.lib.queues worker -Q watchdog`
  - `worker-brief`: same image as api, command `celery -A api.lib.queues worker -Q brief`
  - All containers: `env_file: .env`; `config/runtime/` mounted `:ro`
  - Note: Feature 008 extends this file with `celery-beat`, `worker-mission`, `worker-alert`, `worker-screener`; Feature 009 adds `telegram-bot` + `telegram-worker`; Feature 010 adds `dashboard`
  in `docker-compose.yml`
- [x] T030 [P] [US4] Create `docker-compose.dev.yml` override: volume-mount `apps/api-service/src` into api container; set `RELOAD=true`; `config/runtime/` still `:ro` in `docker-compose.dev.yml`
- [x] T031 [P] [US4] Create `alembic.ini` pointing `script_location = apps/api-service/alembic`; leave `sqlalchemy.url` as placeholder (overridden in env.py) in `alembic.ini`
- [x] T032 [P] [US4] Create `apps/api-service/alembic/env.py` with async migration runner — reads `DATABASE_URL` from environment via `os.environ`, uses `asyncio.run(run_async_migrations())` pattern, imports `Base.metadata` inside a try/except (Feature 002 will populate it), runs with `asyncpg` dialect in `apps/api-service/alembic/env.py`
- [x] T033 [P] [US4] Create empty `apps/api-service/alembic/versions/` directory with a `.gitkeep` placeholder; first migration added by Feature 002 in `apps/api-service/alembic/versions/.gitkeep`

**Checkpoint**: `docker compose up -d` → db and redis containers reach healthy status; `docker compose ps` shows all services; alembic directory structure correct.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final integration validation, documentation completeness, and quality gate confirmation.

- [x] T034 [P] Verify `packages/shared/src/finsight/shared/__init__.py` exports `__version__ = "0.1.0"` and all public symbols from `types.py` in `packages/shared/src/finsight/shared/__init__.py`
- [x] T035 [P] Confirm `load_all_configs()` docstring documents that it loads exactly 5 YAML files and that Feature 003 will extend `AllConfigs` with `api: ApiConfig`; add inline comment noting the extension point in `apps/api-service/src/api/lib/config.py`
- [x] T036 [P] Run the complete quality gate: `uv run pytest` (all offline, all pass) + `uv run mypy --strict` (zero errors) + `uv run ruff check` (zero warnings) — fix any remaining issues across all files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; all tasks T001–T008 parallelisable
- **Foundational (Phase 2)**: Depends on Phase 1 completion; T009 (shared types) must precede schema files if schemas import from `finsight.shared`; T010–T020 parallelisable with each other
- **US1 (Phase 3)**: Depends on Phase 2 — all 5 YAML + schema pairs must exist before `load_all_configs()` is written
- **US2 (Phase 4)**: Depends on T021 (config loader) being complete; T023 and T024 can run in parallel
- **US3 (Phase 5)**: Depends on US1 tests existing (T022); T025–T028 can run in parallel
- **US4 (Phase 6)**: Independent of US1–US3; can run in parallel with Phase 3 after Phase 2 completes; T029–T033 largely parallelisable
- **Polish (Phase 7)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on other stories
- **US2 (P1)**: Shares T021 with US1; T023–T024 start after T021 completes
- **US3 (P2)**: Depends on T022 (tests must exist to validate offline run)
- **US4 (P2)**: Can start after Phase 2 in parallel with US1–US3

### Parallel Opportunities

```
Phase 1: T001 → [T002, T003, T004, T005, T006, T007, T008] in parallel
Phase 2: T009 → [T010–T020] in parallel
Phase 3+4: T021 → T022 → T024; T023 parallel with T022
Phase 5: [T025, T026, T027, T028] in parallel
Phase 6: T029 → [T030, T031, T032, T033] in parallel
Phase 7: [T034, T035, T036] in parallel
```

---

## Parallel Example: Phase 2 (Schemas)

```
# After T009 (shared types), launch all schema pairs together:
Task T010: config/runtime/agents.yaml
Task T011: config/schemas/agents.py
Task T012: config/runtime/mcp.yaml
Task T013: config/schemas/mcp.py
Task T014: config/runtime/pricing.yaml
Task T015: config/schemas/pricing.py
Task T016: config/runtime/watchdog.yaml
Task T017: config/schemas/watchdog.py
Task T018: config/runtime/scheduler.yaml
Task T019: config/schemas/scheduler.py
Task T020: apps/api-service/src/api/lib/logging.py
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (workspace skeleton)
2. Complete Phase 2: Foundational (YAML + schemas — blocks everything)
3. Complete Phase 3: US1 (config loader + settings + 7 tests)
4. **STOP and VALIDATE**: `uv run pytest apps/api-service/tests/test_config.py` — 7/7 pass
5. Foundation ready; all subsequent features can start their config loading

### Incremental Delivery

1. Setup + Foundational → schemas importable
2. US1 → config loader tested → fail-fast guaranteed
3. US2 → error messages validated → .env.example documented
4. US3 → full offline test suite green → mypy + ruff clean
5. US4 → docker-compose + alembic → local dev environment working

---

## Notes

- Tests are **required** by spec (FR-008: test suite must run offline) — included in US1 and US3 phases
- All tests use `tmp_path` + `monkeypatch` — no real files or env vars leaked between tests
- `sys.exit(1)` is caught in tests via `pytest.raises(SystemExit)` with exit code assertion
- `get_settings()` uses `lru_cache` — tests must clear cache between runs via `get_settings.cache_clear()`
- `load_all_configs()` is NOT called at import time — only at FastAPI lifespan startup (Feature 003)
- docker-compose worker containers reference `api.lib.queues` — this module is created in Feature 008; stub is acceptable for Feature 001
- Feature 003 will add `api: ApiConfig` to `AllConfigs` — T035 adds the extension-point comment

