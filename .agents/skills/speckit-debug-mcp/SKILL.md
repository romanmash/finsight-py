---
name: "speckit-debug-mcp"
description: "Reference workflow for adding tools to debug-mcp."
compatibility: "apps/mcp-servers/debug"
---

## Purpose

Use this skill when adding a new tool to `debug-mcp`.

## Required Steps

1. Add tool implementation in `apps/mcp-servers/debug/src/debug_mcp/tools/`.
2. Name tool `debug.<verb>_<noun>` and register in `server.py` `_tool_registry`.
3. Add/extend typed result model in `models.py` and return `ToolResponse[T]`.
4. Add tests for success and error paths in `apps/mcp-servers/debug/tests/`.
5. Enforce caps and expose `capped: bool` when applicable.

## Debug Security Rules

- DB access is read-only only (`DEBUG_DB_URL` + `_assert_select_only()` before execution).
- Redis access is read-only only (no mutating commands).
- Scrub any log/free-text output via `scrub()`.
- `/mcp/` auth is global; do not add per-tool auth logic.

## Validation Checklist

- Cap boundary tests included.
- Unknown/not-found errors return structured `ToolResponse(..., error=...)`.
- External dependencies mocked (offline tests).

## Validation Commands

```bash
uv run mypy --strict
uv run ruff check apps/mcp-servers/debug/
uv run pytest apps/mcp-servers/debug/tests/
```
