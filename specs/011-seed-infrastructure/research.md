# Research: Seed & Infrastructure (011)

## Seed script idempotency strategy

**Chosen**: Fixed demo UUIDs in seed constants + SQLAlchemy `merge()` (upsert by primary key). Running twice produces identical DB state.
**Rationale**: Fixed UUIDs ensure deterministic state; `merge()` is SQLAlchemy's built-in upsert — inserts if not exists, updates if exists. Avoids `ON CONFLICT` raw SQL.
**Alternatives considered**: `ON CONFLICT DO NOTHING` (doesn't update changed fields), check-then-insert (race condition risk), random UUIDs (breaks idempotency)

## Deploy script transport

**Chosen**: rsync over SSH for file transfer; `ssh server "docker compose up -d --build"` for restart; Alembic migration run via SSH before service restart.
**Rationale**: rsync is incremental — only changed files transferred; SSH key auth (no password); ~5 min total per spec SC-001.
**Alternatives considered**: SCP (no incremental), git pull on server (requires git on server, branch management), Ansible (overkill for single server)

## Pulumi Python provider choice

**Chosen**: Pulumi with `pulumi_hcloud` (Hetzner Cloud) as the primary IaC provider, with `pulumi_postgresql` for managed DB and `pulumi_random` for secrets generation
**Rationale**: Hetzner Cloud offers excellent price/performance for personal projects (€5-20/month); Python-native; Pulumi manages state in Pulumi Cloud (free tier). Constitution specifies Pulumi Python.
**Alternatives considered**: AWS (expensive for personal use), DigitalOcean (valid alternative), Terraform (HCL, not Python)

## Migration timing in deploy

**Chosen**: Run `docker compose run --rm api alembic upgrade head` before `docker compose up -d` in deploy.sh; fail deploy on migration error (exit non-zero).
**Rationale**: New service code should never run against unmigraded schema; separate `run --rm` container runs migration in isolation.
**Alternatives considered**: Migration on API startup (races with worker containers starting simultaneously), separate migration container in compose (harder to sequence)

## GitHub Actions CI/CD

**Chosen**: GitHub Actions with: `uv sync`, `uv run mypy --strict`, `uv run ruff check`, `uv run pytest`; triggered on push to main.
**Rationale**: Free for public/private repos; uv is fast; all checks match local development commands; no Docker needed for CI (offline tests).
**Alternatives considered**: GitLab CI (not using GitLab), CircleCI (extra setup), local pre-commit only (no CI gate)

## Seed data coverage

**Chosen**: 1 admin operator + 1 viewer operator, 5 watchlist items (SPY, AAPL, NVDA, GLD, BTC), 3 missions (1 completed, 1 failed, 1 active), 5 agent runs, 3 knowledge entries, 3 alerts (1 ack, 2 unack)
**Rationale**: Covers all entity types; enough data to make dashboard meaningful; realistic tickers; mix of statuses tests all UI states.
**Alternatives considered**: Faker-generated random data (breaks idempotency), minimal 1-of-each (too sparse for realistic dashboard testing)
