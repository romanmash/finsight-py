---
description: "Review code changes against constitution and spec requirements"
---

Review current changes against FinSight quality standards:

1. Read `.specify/memory/constitution.md`
2. Read relevant spec and plan (`specs/$ARGUMENTS/...`) if provided
3. Verify findings against this checklist:
   - [ ] Scope is limited to current spec
   - [ ] Agent boundaries are respected
   - [ ] Runtime behavior is config-driven from YAML
   - [ ] No secrets or credentials in source/docs/tests
   - [ ] Strict typing quality maintained
   - [ ] Tests cover new behavior and run offline
   - [ ] Error handling is explicit and fail-fast where required
   - [ ] Cost tracking requirements are preserved

4. Run and report:
   - `uv run mypy --strict`
   - `uv run ruff check`
   - `uv run pytest`

Provide output as:
- Findings (ordered by severity with file references)
- Open questions/assumptions
- PASS/FAIL decision
