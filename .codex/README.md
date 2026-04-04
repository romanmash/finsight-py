# Codex Workspace Notes

This repository is Codex-first and Python-only.

## Source Of Truth

- Follow `AGENTS.md` for architecture, workflow, and quality gates.
- Follow `.specify/memory/constitution.md` for non-negotiable rules.

## Local Quality Gate Hooks

The hooks in `.codex/hooks/` run the Python quality gate sequence:

1. `uv run ruff check`
2. `uv run mypy --strict`
3. `uv run pytest`

Use them directly or wire them to your local automation.
