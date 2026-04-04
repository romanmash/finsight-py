# Apps Layout Guide

This directory hosts deployable runtime applications. To avoid renames later, names are
role-based (what the app does), not product/brand-based.

## Stable App Names

- `api-service` - backend API + orchestration runtime
- `dashboard` - operator UI
- `telegram-bot` - Telegram interface runtime
- `mcp-servers/*` - independent MCP tool servers

## Naming Rules

1. Keep top-level folder names capability-oriented (`api-service`, `dashboard`), never temporary.
2. Keep Python code under `src/` in every app.
3. Use neutral import namespaces for code (`api`, `dashboard_app`, `telegram_bot`) rather than
   brand-coupled names in module paths.
4. Keep app packaging names stable and explicit in each app `pyproject.toml`.
5. Put cross-app/shared models only in `packages/shared/`, never duplicated under `apps/`.

## Recommended Internal Pattern (per app)

```text
apps/<app-name>/
  pyproject.toml
  src/<python_package>/
  tests/
```

For `api-service`, the current `src/api/` package is acceptable and intentionally neutral.