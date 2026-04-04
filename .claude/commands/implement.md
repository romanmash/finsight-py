---
description: "Implement a feature spec — reads spec.md and plan.md, then implements according to the plan"
---

You are implementing a FinSight AI Hub feature. Follow this workflow exactly:

1. Read `.specify/memory/constitution.md` for project principles
2. Read the spec: `specs/$ARGUMENTS/spec.md`
3. Read the plan: `specs/$ARGUMENTS/plan.md`
4. Read the tasks: `specs/$ARGUMENTS/tasks.md` (if it exists)
5. Implement ONLY files listed in the plan; do not expand scope
6. Update `tasks.md` progress checkboxes as tasks are completed
7. Write tests specified in the plan and verify acceptance criteria

Validation gates (required):
- `uv run mypy --strict`
- `uv run ruff check`
- `uv run pytest`

Critical rules:
- Do NOT implement features from other specs
- Do NOT add behavior not described by current spec/plan/tasks
- Do NOT hardcode runtime behavior; use `config/runtime/*.yaml`
- Keep strict typing and explicit return annotations
- Keep agent boundaries intact (Researcher collects, Analyst reasons, Reporter formats, etc.)
