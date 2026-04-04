---
description: "Execute the implementation plan by processing and executing all tasks defined in tasks.md"
---

## User Input

```text
$ARGUMENTS
```

You MUST consider user input before proceeding.

## Execution Protocol

1. Run prerequisites checker:
   - `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`
2. Load implementation context:
   - `tasks.md` (required)
   - `plan.md` (required)
   - `data-model.md`, `contracts/`, `research.md`, `quickstart.md` (when present)
3. Verify checklist completion status if `checklists/` exists.
4. Execute tasks in dependency order:
   - sequential tasks in order
   - `[P]` tasks may run in parallel if file ownership does not conflict
5. Mark completed tasks as `[X]` in `tasks.md`.
6. Enforce validation gates before completion:
   - `uv run mypy --strict`
   - `uv run ruff check`
   - `uv run pytest`
7. Report final status with completed tasks, failures, and follow-ups.

## Rules

- Do not implement outside active feature scope
- Do not skip failing checklist or validation results
- Halt on blocking failures and report exact blocker
- Keep implementation aligned with constitution constraints
