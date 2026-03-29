---
description: "Create a plan.md (SDD) for a feature spec"
---

Create a technical implementation plan (SDD) for the specified feature:

1. Read `.specify/constitution.md` for project principles
2. Read the spec: `specs/$ARGUMENTS/spec.md`
3. Read `docs/CASE.md` and `docs/CONTEXT.md` for architectural context
4. Verify all dependency specs are complete: each must have both `plan.md` and `tasks.md` with all items checked off. Do not write a plan for a spec whose dependencies are unresolved.

Generate `specs/$ARGUMENTS/plan.md` with this structure:

```markdown
# Implementation Plan: [Feature Name]

## Technical Context
- Dependencies (which specs must be complete first)
- Key technical decisions and rationale
- Constitution compliance notes

## Project Structure
- Exact file paths to create or modify
- Package dependencies to add

## Implementation Details
### [Component 1]
- File: `path/to/file.ts`
- Purpose and key logic
- Interfaces/types used
- Error handling approach

### [Component N]
...

## Testing Strategy
- Unit tests (what to test, what to mock)
- Integration tests (if applicable)
- Test commands

## Complexity Assessment
- Estimated effort
- Risk areas
- Open questions
```

RULES:
- File paths must match the architecture in CLAUDE.md
- All types must come from @finsight/shared-types
- Must specify exact npm dependencies needed
- Must identify what to mock in tests
