---
description: "Implement a feature spec — reads the spec.md and plan.md, then implements according to the plan"
---

You are implementing a FinSight AI Hub feature. Follow this exact workflow:

1. Read `.specify/constitution.md` to understand project principles
2. Read the spec: `specs/$ARGUMENTS/spec.md`
3. Read the plan: `specs/$ARGUMENTS/plan.md`
4. Read the tasks: `specs/$ARGUMENTS/tasks.md` (if it exists)
5. Implement ONLY the files listed in the plan — nothing outside this spec's scope
6. After completing all files in a logical group, run `pnpm -r typecheck` to verify zero errors
7. Write tests as specified in the plan's test requirements
8. Run `pnpm -r test` to verify all tests pass
9. Update `specs/$ARGUMENTS/tasks.md` to mark completed items

CRITICAL RULES:
- Do NOT implement features from other specs
- Do NOT add dependencies not listed in the plan
- Do NOT skip tests — every spec has required tests
- All TypeScript must be strict — no `any`, explicit return types
- All config values come from `config/runtime/*.yaml` — never hardcode
