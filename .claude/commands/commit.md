---
description: "Generate a conventional commit message for staged changes"
---

Generate a commit message for the current staged changes following these rules:

1. Check `git diff --staged` to see what changed
2. Format: `<type>(<scope>): <description>`

Types:
- `feat` — new feature or capability
- `fix` — bug fix
- `docs` — documentation only
- `test` — adding or fixing tests
- `refactor` — code change that neither fixes a bug nor adds a feature
- `chore` — build process, tooling, dependencies

Scopes (use the most specific that applies):
- `types` — @finsight/shared-types package
- `config` — config loader, YAML files, Zod schemas
- `api` — Hono routes, middleware, auth
- `mcp` — MCP servers or MCP client
- `agents` — any of the 9 agents
- `manager` — Manager agent specifically
- `kb` — Knowledge Base / Bookkeeper
- `dashboard` — React admin dashboard
- `telegram` — Telegram bot
- `prisma` — schema, migrations, seed
- `infra` — Docker, Pulumi, CI/CD, scripts
- `spec` — specs/ directory changes

Rules:
- Subject line max 72 characters
- Use imperative mood ("add" not "added" or "adds")
- Don't end subject with period
- Body (if needed) explains WHY, not WHAT

Output ONLY the commit message, nothing else.
