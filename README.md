# FinSight AI Hub

Python-first multi-agent fintech market intelligence platform for operator decision support.

## What This Project Is For

FinSight is designed for a human market operator who wants high-signal analysis without manually
stitching together data from multiple terminals and feeds.

- Ingests market, news, and knowledge-base context through MCP tool servers
- Orchestrates specialist agents to produce structured briefs and alerts
- Delivers outputs through Telegram and a local Dash operator console
- Never executes trades; the human operator remains the final decision maker

## Architecture Walkthrough

- High-level technical pitch (source): [`docs/pitch/PITCH.md`](docs/pitch/PITCH.md)
- Browser-ready rendered pitch (demo): [`docs/pitch/PITCH.html`](docs/pitch/PITCH.html)

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

## Project Status

- Release notes: [CHANGELOG.md](CHANGELOG.md)
- License: [MIT](LICENSE)
- Versioning/release process: [CONTRIBUTING.md](CONTRIBUTING.md#versioning-and-releases)

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

## Debug MCP

FinSight includes an opt-in debug MCP server and browser MCP registration for autonomous diagnosis workflows.

```bash
docker compose --profile debug up -d debug-mcp
curl -s http://localhost:8010/health
```

- Codex MCP registration: `.vscode/mcp.json`
- Claude MCP registration: `.claude/settings.json`
- Browser MCP uses compose network `finsight_default` (adjust if your compose project name differs)
- WSL2 Docker wrapper: `bash scripts/docker-auto.sh ...` (auto-selects `docker` or `docker.exe`)

If Codex sandbox hangs in WSL2, use `danger-full-access` mode in Codex settings/config.

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
It also prints the recommended `uv` PATH setup:

```bash
source "$HOME/.local/bin/env"
# or: export PATH="$HOME/.local/bin:$PATH"
```

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
