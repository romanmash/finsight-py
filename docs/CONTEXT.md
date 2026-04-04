# CONTEXT

FinSight is a Python-first, spec-driven system.

## Environment

- Development on Windows laptop
- Deployment on Ubuntu server
- Local model endpoint available on LAN
- Offline-capable tests and tooling

## Architecture Constraints

- FastAPI backend
- LangGraph supervisor orchestration
- Celery workers with Redis
- PostgreSQL + pgvector
- Runtime behavior in `config/runtime/*.yaml`
- Config validation via Pydantic at startup (fail-fast)

## Non-Negotiables

- No hardcoded business behavior in code
- No secrets in repository
- Strict typing with `mypy --strict`
- Lint with `ruff`
- Tests must run offline
- Agent role boundaries are enforced

## Delivery Workflow

1. Read constitution and spec artifacts
2. Implement only files in the active plan
3. Run `mypy`, `ruff`, and `pytest`
4. Commit with conventional commit format
