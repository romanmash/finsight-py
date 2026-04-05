# Tasks: Seed & Infrastructure (011)

**Feature**: 011-seed-infrastructure
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Total Tasks**: 28
**Generated**: 2026-04-03

## Notes for Implementors

- **Final feature**: This feature depends on all 001–010 features being complete. All entity types
  (Operator, WatchlistItem, Mission, AgentRun, KnowledgeEntry, Alert) must exist before seeding.
- **Seed idempotency**: All demo records use fixed module-level UUIDs in `constants.py`. Every
  seeder uses `session.merge(OrmModel(...))` — upsert by PK. Running seed twice produces the same
  state as running it once.
- **Service JWT**: `seed.py` generates the `TELEGRAM_SERVICE_TOKEN` once via `create_access_token(sub="service:telegram-bot", role="service")` and **prints** it to stdout. The developer copies this value into `.env` on the server manually. It is never written to any file automatically.
- **Knowledge embeddings**: Seed `KnowledgeEntry` rows use `embedding=None` (NULL). The Bookkeeper
  writes real vectors when missions run. Similarity search uses `WHERE embedding IS NOT NULL` so
  seed rows are never returned as search results.
- **Pulumi isolation**: `infra/pulumi/` uses its own `requirements.txt` + Pulumi-managed `.venv`.
  Do NOT add it to the uv workspace (`[tool.uv.workspace]`). This is standard Pulumi Python layout.
- **No Docker in CI**: All pytest tests run offline. CI does not start Docker.
- **Bash scripts**: `deploy.sh` and `logs.sh` are bash scripts. On Windows dev, run via WSL or
  Git Bash. `set -euo pipefail` at top of each script.
- **Migration before restart**: deploy.sh runs `alembic upgrade head` before `docker compose up -d --build`. If migration fails, services are NOT restarted — prevents broken-schema deployments.
- **bcrypt password hashing**: Seed operator passwords with `bcrypt.hashpw(password.encode(), bcrypt.gensalt())`. Verify in tests that `password_hash` starts with `$2b$`.

---

## Phase 1: Setup

- [X] T001 Create `apps/api-service/src/api/seeds/__init__.py` as empty stub
- [X] T002 Create `apps/api-service/tests/seeds/__init__.py` as empty stub

---

## Phase 2: Foundational — Seed Constants and Entry Point

- [X] T003 Create `apps/api-service/src/api/seeds/constants.py` with all demo UUIDs as module-level constants: `ADMIN_OPERATOR_ID`, `VIEWER_OPERATOR_ID`, `WATCHLIST_AAPL_ID`, `WATCHLIST_NVDA_ID`, `WATCHLIST_MSFT_ID`, `WATCHLIST_SPY_ID`, `WATCHLIST_QQQ_ID`, `MISSION_INVESTIGATION_ID`, `MISSION_DAILY_BRIEF_ID`, `MISSION_SCREENER_ID`, `AGENT_RUN_RESEARCHER_ID`, `AGENT_RUN_ANALYST_ID`, `AGENT_RUN_REPORTER_ID`, `KB_ENTRY_AAPL_ID`, `KB_ENTRY_NVDA_ID`, `KB_ENTRY_MARKET_ID`, `ALERT_AAPL_ID`, `ALERT_NVDA_ID`, `ALERT_SPY_ID`; all as `uuid.UUID` literals; never generated with `uuid4()` at runtime
- [X] T004 Create `apps/api-service/src/api/seeds/seed.py` as main entry point: `async def seed(session: AsyncSession) -> None` calls all seeders in dependency order: operators → watchlist → missions (with agent_runs) → knowledge → alerts; each seeder is imported and awaited; after all seeders complete, generates and prints `TELEGRAM_SERVICE_TOKEN` via `create_access_token(sub="service:telegram-bot", role="service", ttl_days=365)` from `apps/api-service/src/api/lib/auth.py`; `if __name__ == "__main__": asyncio.run(main())` entry point connects to PostgreSQL from env

---

## Phase 3: User Story 2 — Seed Data (P1)

**Goal**: `uv run python -m api.seeds.seed` populates all entity types; idempotent.
**MVP note**: MVP is not complete after this phase alone; complete Phase 4 (US1 deploy script) as well.

**Independent test**: SQLite in-memory engine → `seed()` called twice → row counts identical; no duplicate PKs; `password_hash` starts with `$2b$`.

- [X] T005 [US2] Create `apps/api-service/src/api/seeds/operators.py` with `async def seed_operators(session: AsyncSession) -> None`: creates admin operator (`username="admin"`, `role="admin"`, `telegram_user_id=<fixed int>`, `telegram_chat_id=<fixed int>`, password hashed with bcrypt) and viewer operator (`username="viewer"`, `role="viewer"`) using `session.merge()`; all timestamps fixed to past datetime
- [X] T006 [P] [US2] Create `apps/api-service/src/api/seeds/watchlist.py` with `async def seed_watchlist(session: AsyncSession) -> None`: creates 5 WatchlistItem records (AAPL, NVDA, MSFT as stock watchlist; SPY, QQQ as ETF watchlist) with realistic thresholds (`price_change_threshold`, `volume_spike_threshold`), all `active=True`, using `session.merge()` with fixed UUIDs
- [X] T007 [P] [US2] Create `apps/api-service/src/api/seeds/missions.py` with `async def seed_missions(session: AsyncSession) -> None`: creates 3 Mission records (investigation COMPLETED, daily_brief COMPLETED, screener_scan FAILED) using `session.merge()`; creates 3 AgentRun records (researcher, analyst, reporter) attached to the investigation mission with realistic `tokens_in`, `tokens_out`, `cost_usd`, `model`, `provider`, `duration_ms` values; all timestamps fixed to past datetimes
- [X] T008 [P] [US2] Create `apps/api-service/src/api/seeds/knowledge.py` with `async def seed_knowledge(session: AsyncSession) -> None`: creates 3 KnowledgeEntry records (AAPL Q4 earnings analysis, NVDA chip demand outlook, broad market macro context) using `session.merge()`; `embedding=None` on all entries; `source_agent="bookkeeper"`, `confidence=0.85`; `conflict_markers=[]`; one entry has `conflict_markers=["Contradicts prior Q3 assessment"]` to demonstrate the conflict indicator in the dashboard
- [X] T009 [P] [US2] Create `apps/api-service/src/api/seeds/alerts.py` with `async def seed_alerts(session: AsyncSession) -> None`: creates 3 Alert records — one `acknowledged=False` (AAPL price spike), two `acknowledged=True` (NVDA volume anomaly, SPY threshold breach) — using `session.merge()` with fixed UUIDs and fixed past timestamps
- [X] T010 [US2] Create `apps/api-service/tests/seeds/test_seed.py` with 4 tests using in-memory SQLite async engine (same aiosqlite pattern as Feature 002): (1) first `seed()` call → all entity types have correct row counts (2 operators, 5 watchlist items, 3 missions, 3 agent runs, 3 KB entries, 3 alerts), (2) second `seed()` call → identical row counts (idempotency verified), (3) admin operator `password_hash` starts with `$2b$` (bcrypt confirmed), (4) all KB entries have `embedding IS NULL`

---

## Phase 4: User Story 1 — Deploy Script (P1)

**Goal**: `./scripts/deploy.sh` rsync + SSH + migrate + restart from dev laptop.

**Independent test**: manual smoke test (script-level) — run with missing `SERVER_HOST` → exits non-zero with descriptive error.

- [X] T011 [US1] Create `scripts/deploy.sh` with `set -euo pipefail`; source `.env` at start; validate required vars (`SERVER_HOST`, `SERVER_USER`, `SERVER_PATH`, `SERVER_SSH_KEY`) — exit 1 with message listing missing vars if any absent; `rsync -avz --exclude='.env' --exclude='__pycache__' --exclude='.git' -e "ssh -i $SERVER_SSH_KEY -o ConnectTimeout=10" . $SERVER_USER@$SERVER_HOST:$SERVER_PATH`; SSH `alembic upgrade head` — exit 1 on failure with "Migration failed. Aborting deployment. Services NOT restarted."; SSH `docker compose up -d --build`; SSH `curl -sf http://localhost:8000/health || exit 1`; print "Deployment complete. All services healthy." on success
- [X] T012 [US1] Add `SERVER_HOST`, `SERVER_USER`, `SERVER_PATH`, `SERVER_SSH_KEY` to `.env.example` with placeholder values and comments explaining each variable
- [X] T013 [US1] Verify `deploy.sh` is executable: `chmod +x scripts/deploy.sh` (add note in comment at top of file: `# Run: bash scripts/deploy.sh`)

---

## Phase 5: User Story 4 — Log Streaming Script (P2)

**Goal**: `./scripts/logs.sh <service>` streams live logs from the named container.

- [X] T014 [US4] Create `scripts/logs.sh` with `set -euo pipefail`; source `.env`; validate `SERVER_HOST`, `SERVER_USER`, `SERVER_PATH`, `SERVER_SSH_KEY`; define valid service names array: `(api celery-beat worker-mission worker-alert worker-screener worker-watchdog worker-brief telegram-bot telegram-worker dashboard postgres redis market-data-mcp news-macro-mcp rag-retrieval-mcp)`; if `$1` not in array → exit 1 with "Unknown service '$1'. Valid services: ${VALID_SERVICES[*]}"; SSH `cd $SERVER_PATH && docker compose logs -f $1`

---

## Phase 6: User Story 3 — Pulumi IaC (P2)

**Goal**: `pulumi up` provisions Hetzner Cloud server + firewall + SSH key + volume.

- [X] T015 [US3] Create `infra/pulumi/Pulumi.yaml` with `name: finsight`, `runtime: python`, `description: FinSight AI Hub infrastructure`
- [X] T016 [P] [US3] Create `infra/pulumi/Pulumi.dev.yaml` with dev stack config: `finsight:server_type: cx21`, `finsight:region: nbg1`, `finsight:volume_size_gb: 20`
- [X] T017 [P] [US3] Create `infra/pulumi/requirements.txt` with `pulumi>=3.0`, `pulumi-hcloud` — do NOT add to uv workspace; Pulumi manages its own `.venv`
- [X] T018 [US3] Create `infra/pulumi/__main__.py` with: SSH key from `PULUMI_SSH_PUBLIC_KEY` env var (never hardcoded); `hcloud.SshKey("finsight-key", public_key=os.environ["PULUMI_SSH_PUBLIC_KEY"])`; `hcloud.Server("finsight-server", server_type=config.get("server_type"), image="ubuntu-24.04", ssh_keys=[ssh_key.id])`; `hcloud.Firewall("finsight-fw")` allowing only ports 22, 80, 443 inbound; `hcloud.Volume("postgres-data", size=config.get_int("volume_size_gb"))` attached to server; `pulumi.export("server_ip", server.ipv4_address)`
- [X] T019 [US3] Add `PULUMI_SSH_PUBLIC_KEY` and `HCLOUD_TOKEN` to `.env.example` with placeholder values and comments

---

## Phase 7: GitHub Actions CI

- [X] T020 Create `.github/workflows/ci-cd.yml` with trigger `on: push: branches: [main]`; single job `ci` on `ubuntu-latest`; steps: `actions/checkout@v4`, `astral-sh/setup-uv@v3` with `python-version: "3.13"`, `uv sync --all-packages`, `uv run mypy --strict apps/ packages/`, `uv run ruff check apps/ packages/`, `uv run pytest --tb=short -q`; add `UV_CACHE_DIR` env for caching

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T021 Add `if __name__ == "__main__"` block to `apps/api-service/src/api/seeds/seed.py` that creates async SQLAlchemy engine from `DATABASE_URL` env var, creates session, calls `seed(session)`, closes connection; register as `uv run python -m api.seeds.seed` entrypoint in `apps/api-service/pyproject.toml` `[project.scripts]` as `finsight-seed`
- [X] T022 Verify all 6 seeder modules are imported and called in correct dependency order in `seed.py`: operators first (no foreign key deps), watchlist second (no FK deps), missions third (depends on operators via `created_by`), agent_runs within missions seeder (depends on missions), knowledge fourth (standalone), alerts fifth (depends on watchlist items via `ticker`)
- [X] T023 Verify `scripts/deploy.sh` handles the migration-before-restart invariant: add a comment block and explicit `set -e` guard around the migration SSH call so any non-zero exit stops the script before `docker compose up -d --build` is reached
- [X] T024 Verify `infra/pulumi/__main__.py` has no hardcoded credentials: grep for `HCLOUD_TOKEN` — must appear only in `.env.example`, never in `__main__.py`; token is consumed by Pulumi CLI automatically from env
- [X] T025 Export `seed` function from `apps/api-service/src/api/seeds/__init__.py` for test import
- [X] T026 Run `uv run mypy --strict apps/api-service/src/api/seeds/` — zero errors required
- [X] T027 Run `uv run ruff check apps/api-service/src/api/seeds/` — zero warnings required
- [X] T028 Run `uv run pytest apps/api-service/tests/seeds/ -v` — all 4 seed tests must pass offline without PostgreSQL or network access

---

## Dependency Graph

```
Phase 1 (T001–T002) → Phase 2 (T003–T004) → Phase 3 US2 (T005–T010)
Phase 1 → Phase 4 US1 (T011–T013)  [independent of seed]
Phase 1 → Phase 5 US4 (T014)       [independent of seed]
Phase 1 → Phase 6 US3 (T015–T019)  [independent of seed]
Phase 1 → Phase 7 (T020)           [independent of everything else]
All phases → Phase 8 (T021–T028)
```

**External dependencies (all prior features must be complete)**:
- Feature 002: All ORM models (`Operator`, `WatchlistItem`, `Mission`, `AgentRun`, `KnowledgeEntry`, `Alert`)
- Feature 003: `create_access_token()` in `apps/api-service/src/api/lib/auth.py` (for service JWT generation)
- Feature 007: `KnowledgeEntry.conflict_markers: list[str]` field; `embedding: list[float] | None = None`

---

## Parallel Execution Opportunities

Within Phase 3 (US2), after T003–T004 are complete:
- T005 (operators.py), T006 (watchlist.py), T007 (missions.py), T008 (knowledge.py), T009 (alerts.py) can all run in parallel — different files, no inter-seeder imports

Phases 4 (US1), 5 (US4), 6 (US3), 7 (CI) are all independent and can run in parallel.

---

## Implementation Strategy

**MVP scope** (US1 + US2): Implement T001–T013. This delivers deployment automation + seed data — the two P1 stories. US3 (Pulumi IaC) and US4 (log script) are P2 and can follow.

**Incremental delivery**:
1. T001–T004: Seed constants + entry point scaffolded
2. T005–T009: All entity seeders written
3. T010: Idempotency tests written and passing
4. T011–T013: Deploy script complete
5. T014: Log streaming script
6. T015–T019: Pulumi IaC
7. T020: GitHub Actions CI
8. T021–T028: Quality gate
