# SpecKit Workflow

This project uses SpecKit artifacts in `specs/`.

## Standard Loop

1. `spec.md` defines scope and acceptance
2. `plan.md` defines architecture and files
3. `tasks.md` defines executable work order
4. Implement only current feature scope
5. Validate with:
   - `uv run mypy --strict`
   - `uv run ruff check`
   - `uv run pytest`

## Rule

Do not implement work outside the active feature directory.
