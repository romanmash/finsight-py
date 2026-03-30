---
description: "Review code changes against the constitution and spec requirements"
---

Review the current changes against FinSight's quality standards:

1. Read `.specify/memory/constitution.md` for project principles
2. Check the relevant spec: `specs/$ARGUMENTS/spec.md` (if argument provided) or infer from changed files
3. Verify:
   - [ ] Agent boundaries respected — no agent crosses into another's domain
   - [ ] All config from YAML — no hardcoded thresholds, model names, or schedules
   - [ ] TypeScript strict — no `any`, explicit return types, all imports from `@finsight/shared-types`
   - [ ] Tests exist for new behavior — offline tests only (mocked APIs)
   - [ ] Conventional commit message format
   - [ ] No scope creep — only files listed in the current spec's plan
   - [ ] Error handling — fail-fast on config errors, graceful on runtime errors
   - [ ] Agent state protocol — Redis state before/after execution with 10min TTL
   - [ ] Cost tracking — every LLM call records tokens + cost in AgentRun

4. Run `pnpm -r typecheck` and report any errors
5. Run `pnpm -r test` and report any failures
6. Provide a summary: PASS/FAIL with specific issues listed
