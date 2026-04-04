# Quickstart: Foundation & Config

**Feature**: `001-python-foundation-config` | **Date**: 2026-04-02

## Prerequisites

- Python 3.13 installed and on PATH
- `uv` installed (`pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Docker (server) or Podman (Windows dev) with Compose support

---

## 1. First-Time Setup

```bash
# Clone and enter the repo
git clone <repo-url> finsight
cd finsight

# Copy environment template and fill in your values
cp .env.example .env
# Edit .env: set DATABASE_URL, REDIS_URL, OPENAI_API_KEY at minimum

# Install all workspace dependencies (creates .venv)
uv sync

# Verify type checking passes
uv run mypy --strict

# Verify linting passes
uv run ruff check
```

---

## 2. Start Local Infrastructure

```bash
# Start database (postgres+pgvector) and Redis only — no app containers yet
docker compose up -d db redis

# Wait ~10 seconds, then verify both are healthy
docker compose ps
```

---

## 3. Apply Database Migrations

```bash
uv run alembic upgrade head
# Expected output: "Running upgrade -> 001_initial_schema, ..."
```

---

## 4. Start the API

```bash
uv run uvicorn apps.api.src.api.main:app --reload --port 8000
```

Open `http://localhost:8000/health` — expected response:

```json
{
  "status": "healthy",
  "database": {"status": "ok", "detail": null},
  "cache": {"status": "ok", "detail": null},
  "config": {"status": "ok", "detail": null}
}
```

---

## 5. Run the Test Suite (Offline)

No Docker required. No network required.

```bash
uv run pytest
# Expected: all tests pass, 0 errors, 0 warnings
```

Run with coverage:

```bash
uv run pytest --cov=apps/api-service/src --cov=packages/shared/src --cov-report=term-missing
```

---

## 6. Verify Fail-Fast Config Validation

```bash
# Temporarily break a config file
echo "agents: not_a_dict" > config/runtime/agents.yaml

# Try to start the API — should exit immediately with an error
uv run python -c "from apps.api.src.api.lib.config import load_all_configs; load_all_configs()"
# Expected: Config error in config/runtime/agents.yaml: ...

# Restore the file
git checkout config/runtime/agents.yaml
```

---

## 7. Full Docker Compose Stack

```bash
# Start all services
docker compose up -d

# Tail logs
docker compose logs -f api

# Stop everything
docker compose down
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `uv sync` fails | Python 3.13 not found | Run `uv python install 3.13` |
| `alembic upgrade head` fails | DB not running | Run `docker compose up -d db` first |
| `sys.exit` on startup | YAML config error | Read the error message — it names the file and field |
| Tests fail with import errors | Editable install missing | Re-run `uv sync` |
| `mypy` errors | Missing type stubs | Run `uv add --dev types-PyYAML types-redis` |
