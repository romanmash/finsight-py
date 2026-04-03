# Implementation Plan: Seed & Infrastructure

**Branch**: `011-seed-infrastructure` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Deliver the final operational layer: a bash deploy script (rsync + SSH + Alembic migrate +
docker compose restart, < 5 min), an idempotent Python seed module using fixed UUIDs + SQLAlchemy
merge(), Pulumi Python IaC defining the Linux server + firewall + storage, a bash log-streaming
script, and a GitHub Actions CI pipeline. All scripts exit non-zero with descriptive errors on
precondition failure. Seed idempotency verified by automated test against in-memory SQLite.

## Technical Context

**Language/Version**: Python 3.13 (seed + Pulumi) + bash (deploy/logs scripts)
**Primary Dependencies**: pulumi>=3.0, pulumi-hcloud, sqlalchemy[asyncio] (for seed), bcrypt (for hashed demo passwords)
**Storage**: PostgreSQL 16 (seed target), Pulumi Cloud (IaC state)
**Testing**: pytest + pytest-asyncio + aiosqlite (seed idempotency, offline)
**Target Platform**: Scripts: Windows 11 dev + Linux server; IaC: Hetzner Cloud
**Project Type**: Operational scripts + Python seed module + Pulumi IaC
**Performance Goals**: Deploy < 5 min; seed < 30 s; logs.sh streams within 2 s
**Constraints**: Scripts must exit non-zero with descriptive errors; seed must be idempotent; no hardcoded secrets
**Scale/Scope**: ~10 containers; ~6 entity types; ~20 demo records

## Constitution Check

- [x] Everything-as-Code — infrastructure defined as Pulumi Python; seed data as code; CI as GitHub Actions YAML
- [x] Agent Boundaries — N/A (infrastructure layer)
- [x] MCP Server Independence — N/A
- [x] Cost Observability — N/A
- [x] Fail-Safe Defaults — deploy fails on migration error; scripts exit non-zero with descriptive messages
- [x] Test-First — seed idempotency tested offline with SQLite
- [x] Simplicity Over Cleverness — bash scripts (no Python wrapper needed); Pulumi for IaC (Python-native)
- [x] Secrets — SERVER_HOST, SERVER_USER, SERVER_SSH_KEY from .env only; no secrets in scripts

## Project Structure

### Source Code

```text
scripts/
├── deploy.sh            # rsync + SSH migrate + docker compose restart
└── logs.sh              # SSH + docker compose logs -f <service>

apps/api/src/api/seeds/
├── __init__.py
├── seed.py              # Main entry point: run all seeders
├── constants.py         # Fixed demo UUIDs
├── operators.py         # Seed operators (admin + viewer)
├── watchlist.py         # Seed 5 watchlist items
├── missions.py          # Seed 3 missions + agent runs
├── knowledge.py         # Seed 3 knowledge entries
└── alerts.py            # Seed 3 alerts

infra/pulumi/
├── Pulumi.yaml          # Project name + runtime: python
├── Pulumi.dev.yaml      # Dev stack config
├── requirements.txt     # pulumi, pulumi-hcloud, etc.
└── __main__.py          # Server + firewall + SSH key + volume

.github/workflows/
└── ci-cd.yml            # uv sync + mypy + ruff + pytest on push to main

apps/api/tests/seeds/
└── test_seed.py         # idempotency test: run seed twice, assert identical state
```

## Implementation Phases

### Phase 1: Deploy Script

**Files**: `scripts/deploy.sh`

**Key decisions**:
- Source `.env` to get SERVER_HOST, SERVER_USER, SERVER_PATH, SERVER_SSH_KEY
- Exit 1 with message if any required var is missing
- `rsync -avz --exclude='.env' --exclude='__pycache__' -e "ssh -i $SERVER_SSH_KEY" . $SERVER_USER@$SERVER_HOST:$SERVER_PATH`
- `ssh ... "cd $SERVER_PATH && docker compose run --rm api alembic upgrade head"` — exit 1 on failure
- `ssh ... "cd $SERVER_PATH && docker compose up -d --build"` — exit 1 on failure
- `ssh ... "curl -sf http://localhost:8000/health"` — verify health; exit 1 if unhealthy

**Edge case handling**:
- SSH connection failure → `ssh -o ConnectTimeout=10` + descriptive error
- Migration failure → print error, do NOT restart services (prevents broken state)
- Interrupted deploy: rsync is resumable; migration is idempotent (Alembic)

### Phase 2: Log Script

**Files**: `scripts/logs.sh`

**Key decisions**:
- Valid service names hardcoded as array: `(api celery-worker celery-beat market-data-mcp news-macro-mcp rag-retrieval-mcp dashboard telegram-bot postgres redis)`
- Invalid name → exit 1 with "Unknown service. Valid services: ..."
- `ssh ... "cd $SERVER_PATH && docker compose logs -f $SERVICE"`

### Phase 3: Seed Constants + Entry Point

**Files**: `apps/api/src/api/seeds/constants.py`, `seeds/seed.py`

**Key decisions**:
- All demo UUIDs as module-level constants (never random)
- `seed.py` runs all seeders in dependency order: operators → watchlist → missions → agent_runs → knowledge → alerts
- Each seeder uses `session.merge(OrmModel(...))` — upsert by PK

### Phase 4: Individual Seeders

**Files**: `apps/api/src/api/seeds/operators.py` + `watchlist.py` + `missions.py` + `knowledge.py` + `alerts.py`

**Key decisions**:
- Passwords hashed with bcrypt at seed time (not stored as plain text)
- `seed.py` generates the Telegram service JWT once and prints it:
  ```
  TELEGRAM_SERVICE_TOKEN=<generated-value>   # add to .env on server
  ```
  Uses `create_access_token(sub="service:telegram-bot", role="service")` from `apps/api/lib/auth.py`.
  Token is printed to stdout — never written to any file automatically.
- Knowledge entries use `embedding=NULL` — seed entries carry no vector; the Bookkeeper writes real embeddings when missions run. Similarity search queries use `WHERE embedding IS NOT NULL` so seed rows are never returned as search results.
- All `created_at`/`updated_at` fields set to fixed past timestamps for realistic dashboard display

### Phase 5: Pulumi IaC

**Files**: `infra/pulumi/__main__.py`, `Pulumi.yaml`, `Pulumi.dev.yaml`, `infra/pulumi/requirements.txt`

**Key decisions**:
- `hcloud.Server("finsight-server", server_type="cx21", image="ubuntu-24.04")`
- `hcloud.Firewall` allowing only ports 22, 80, 443 inbound
- `hcloud.Volume("postgres-data", size=20)` attached to server for DB persistence
- SSH key from `.env` PULUMI_SSH_PUBLIC_KEY (never hardcoded)
- **`infra/pulumi/requirements.txt` is intentionally not a `pyproject.toml`**: Pulumi manages
  its own Python virtual environment (`infra/pulumi/.venv`) independently of the uv workspace.
  Adding it as a uv workspace member would conflict with Pulumi's venv management. This is the
  standard Pulumi Python project layout — do not attempt to add it to the uv workspace.

### Phase 6: GitHub Actions CI

**Files**: `.github/workflows/ci-cd.yml`

**Key decisions**:
- Trigger: `on: push: branches: [main]`
- Steps: `uv sync` → `uv run mypy --strict` → `uv run ruff check` → `uv run pytest`
- Python 3.13 matrix; uv cache for speed
- No Docker in CI (all tests are offline)

### Phase 7: Seed Idempotency Test

**Files**: `apps/api/tests/seeds/test_seed.py`

**Key decisions**:
- Uses in-memory SQLite async engine (same pattern as Feature 002 tests)
- Call `seed()` twice; verify row counts identical; verify no duplicate PKs
- Verify operator passwords are hashed (not plain text in DB)

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Seed idempotency | Fixed UUIDs + SQLAlchemy merge() | Deterministic state; safe to re-run |
| Deploy migration timing | Before docker compose up | Prevents new code on old schema |
| Pulumi provider | Hetzner Cloud (hcloud) | Best price/performance for personal use |
| Knowledge embeddings | NULL in seed | Bookkeeper writes real vectors; seed rows excluded from similarity search via `WHERE embedding IS NOT NULL` |
| CI environment | Ubuntu + Python 3.13 + uv | Matches production; fast installs |

## Testing Strategy

- Seed test: create SQLite DB → run seed() → count rows per entity → run seed() again → verify counts unchanged
- Verify no exceptions on second run
- Verify operator.password_hash starts with "$2b$" (bcrypt)

## Dependencies

- **Requires**: 001 through 010 (all features — seed covers all entity types)
- **Required by**: nothing (final feature)
