# FinSight AI Hub

Python-first multi-agent fintech market intelligence platform.

## Quick Start

```bash
# Prerequisites: Python 3.13, uv, Docker/Podman
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run python -m api.seeds.seed
uv run pytest
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for workflow, commit conventions, and PR checklist.

## Repository Structure

- `packages/shared/` - shared Python domain models
- `apps/api-service/` - FastAPI app, agents, workers
- `apps/mcp-servers/` - Python MCP servers
- `apps/dashboard/` - Dash operator console
- `apps/telegram-bot/` - python-telegram-bot app
- `config/runtime/` - YAML runtime config
- `config/schemas/` - Pydantic validation models
- `specs/` - feature specs and execution order

## Development Workflow

1. Read `.specify/memory/constitution.md`
2. Read `specs/README.md` and the target `specs/NNN-*/spec.md` + `plan.md`
3. Implement only in current spec scope
4. Run quality gates and commit with Conventional Commits

## Quality Gates

```bash
uv run mypy --strict
uv run ruff check
uv run pytest
```

Codex hook equivalents:

```bash
bash .codex/hooks/python-quality-check.sh
```

## Git Hooks

Install repo-managed hooks once per clone:

```bash
bash scripts/setup-git-hooks.sh
```

`setup-git-hooks.sh` prints `export` lines for your shell profile.

Hooks installed:
- `pre-commit`: `uv run ruff check` + `uv run mypy --strict`
- `pre-push`: `uv run pytest`

## AI Agent Support

- `AGENTS.md` is the universal source of agent instructions (Codex-primary).
- `CLAUDE.md` stays as a thin entrypoint for Claude tooling.
- `.codex/hooks/` contains local Codex quality helper scripts.

## Core References

- `AGENTS.md`
- `.codex/README.md`
- `.specify/memory/constitution.md`
- `docs/CONTEXT.md`
- `docs/STACK.md`
- `specs/README.md`
