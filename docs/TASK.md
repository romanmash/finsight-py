# Execution Checklist

Use this checklist before each implementation cycle:

1. Confirm active feature in `specs/README.md`
2. Read constitution and active `spec.md`/`plan.md`
3. Execute tasks from `tasks.md` in dependency order
4. Run quality gates:
   - `uv run mypy --strict`
   - `uv run ruff check`
   - `uv run pytest`
5. Record review findings and fix all issues
6. Commit using conventional commits
