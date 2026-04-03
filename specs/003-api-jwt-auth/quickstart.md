# Quickstart: API & JWT Auth (003)

## Prerequisites

- Feature 001 complete (uv monorepo, pyproject.toml, docker-compose.yml)
- Feature 002 complete (database models, Alembic migration applied)
- `.env` with `JWT_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`

## Running

```bash
# Apply migrations (first time)
uv run alembic upgrade head

# Start just postgres + redis for local dev
docker compose up -d postgres redis

# Run the API server
uv run uvicorn api.main:app --reload --port 8000
```

## Testing

```bash
# All auth tests (offline, no server needed)
uv run pytest apps/api/tests/routes/test_auth.py -v

# Type check
uv run mypy apps/api/src/ --strict

# Lint
uv run ruff check apps/api/src/
```

## Manual Verification

```bash
# Bootstrap first admin (seed script)
uv run python -m api.seeds.seed

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "demo_password"}' \
  -c cookies.txt

# Use access token
TOKEN=$(curl -s ... | jq -r .access_token)
curl http://localhost:8000/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Health (no auth)
curl http://localhost:8000/health
```
