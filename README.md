# FinSight AI Hub

Python-first multi-agent stock market intelligence platform for investor decision support.

<p align="center">
  <img src="docs/assets/repo-card.png" alt="FinSight AI Hub repository card" width="100%">
</p>

## Purpose

FinSight is designed for an investor who wants high-signal analysis without manually stitching together data from multiple terminals and feeds.

- Ingests market, news, and knowledge-base context through MCP tool servers
- Orchestrates specialist agents to produce structured briefs and alerts
- Delivers outputs through Telegram and a local Dash operator console
- Never executes trades; the investor remains the final decision maker

## How It Works

- A LangGraph supervisor coordinates specialist agents that each own one responsibility.
- Four FastMCP tool servers provide market data, news/macro signals, semantic retrieval, and runtime diagnostics.
- The API and background pipelines run on FastAPI + Celery + Redis with PostgreSQL-backed state and checkpoints.
- Investors interact through Telegram (text/voice) and a Dash console, receive structured briefs, and make the final decision.

## Architecture Pitch

- High-level technical pitch (source): [`docs/pitch/PITCH.md`](docs/pitch/PITCH.md)
- Browser-ready rendered pitch (demo): [`docs/pitch/PITCH.html`](docs/pitch/PITCH.html)

## Tech Stack

- Core platform: `Python`, `uv`, `FastAPI`, `Pydantic`
- Agent system: `LangGraph`, `LangChain`, `FastMCP`, `LangSmith`
- Data and storage: `PostgreSQL`, `pgvector`, `SQLAlchemy`, `Alembic`, `Redis`, `Celery`
- Interfaces: `Telegram` (voice via `Whisper`), `Dash`
- Delivery and quality: `Docker`, `Pulumi`, `GitHub Actions`, `pytest`, `mypy`

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

## Documentation

Boundaries:

- Product and architecture context: [docs/README.md](docs/README.md)
- Contributor workflow and quality gates: [CONTRIBUTING.md](CONTRIBUTING.md)
- Feature specifications and execution order: [specs/README.md](specs/README.md)

Project links:

- Release notes: [CHANGELOG.md](CHANGELOG.md)
- License: [MIT](LICENSE)
- Versioning and release process: [CONTRIBUTING.md](CONTRIBUTING.md#versioning-and-releases)

Core references:

- [AGENTS.md](AGENTS.md) - agent collaboration rules and constraints
- [.specify/memory/constitution.md](.specify/memory/constitution.md) - non-negotiable engineering principles
- [docs/CONTEXT.md](docs/CONTEXT.md) - architecture decisions and runtime constraints
- [docs/STACK.md](docs/STACK.md) - locked technology stack and rationale
- [specs/README.md](specs/README.md) - feature catalogue and dependency order
