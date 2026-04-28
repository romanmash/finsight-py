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

## Documentation Boundaries

- Product and architecture context: [docs/README.md](docs/README.md)
- Contributor workflow and quality gates: [CONTRIBUTING.md](CONTRIBUTING.md)
- Feature specifications and execution order: [specs/README.md](specs/README.md)

## Core References

- [AGENTS.md](AGENTS.md)
- [.specify/memory/constitution.md](.specify/memory/constitution.md)
- [docs/CONTEXT.md](docs/CONTEXT.md)
- [docs/STACK.md](docs/STACK.md)
- [specs/README.md](specs/README.md)
