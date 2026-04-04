---
description: "Generate a conventional commit message for staged changes"
---

Generate a commit message for the current staged changes following these rules:

1. Run `git diff --staged --name-status` and `git diff --staged` to inspect what changed.
2. Format: `<type>(<scope>): <description>`

Types:
- `feat` — new feature or capability
- `fix` — bug fix
- `docs` — documentation only
- `test` — adding or fixing tests
- `refactor` — code change that neither fixes a bug nor adds a feature
- `chore` — build process, tooling, dependencies

Scopes (use the most specific that applies):
- `shared` — `packages/shared`
- `config` — runtime YAML + Pydantic schema/config loading
- `api` — FastAPI routes, middleware, auth
- `mcp` — MCP servers or MCP client
- `agents` — agent implementations
- `graph` — LangGraph orchestration
- `kb` — knowledge base / Bookkeeper paths
- `dashboard` — Dash operator console
- `telegram` — Telegram bot
- `db` — SQLAlchemy models, Alembic migrations
- `infra` — Docker, Pulumi, CI/CD, scripts
- `spec` — specs directory changes

Rules:
- Subject line max 72 characters
- Use imperative mood ("add" not "added" or "adds")
- Do not end subject with a period
- Body (if needed) explains WHY, not WHAT

Before finalizing the message, verify quality gates are green:
- `uv run mypy --strict`
- `uv run ruff check`
- `uv run pytest`

Output ONLY the commit message, nothing else.
