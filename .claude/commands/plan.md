---
description: "Create a plan.md (SDD) for a feature spec"
---

Create a technical implementation plan (SDD) for the specified feature:

1. Read `.specify/memory/constitution.md`
2. Read `specs/$ARGUMENTS/spec.md`
3. Read `docs/CONTEXT.md` and `docs/STACK.md`
4. Confirm dependency specs are complete before planning

Generate `specs/$ARGUMENTS/plan.md` with this structure:

```markdown
# Implementation Plan: [Feature Name]

## Technical Context
- Dependencies and readiness
- Key decisions and rationale
- Constitution compliance notes

## Project Structure
- Exact file paths to create/modify
- Python package/module boundaries

## Implementation Details
### [Component 1]
- File: `path/to/file.py`
- Purpose and key logic
- Types/interfaces and contracts
- Error handling strategy

## Testing Strategy
- Unit tests (what to mock and why)
- Integration tests (if applicable)
- Commands: mypy/ruff/pytest

## Complexity Assessment
- Estimated effort
- Risk areas
- Open questions
```

Rules:
- File paths must align with AGENTS.md architecture
- Keep everything Python-first
- Include validation and rollback strategy where relevant
- Explicitly list what external services are mocked in tests
