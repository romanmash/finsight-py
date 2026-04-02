# Manual-to-Canonical Parity Matrix (011)

**Purpose**: Ensure important implementation details from `manual-spec-original.md` are explicitly preserved for planning/tasks and not silently dropped.

| Original Manual Detail | Preservation Status | Canonical Location | Notes |
|---|---|---|---|
| Seed command is `pnpm prisma db seed` | Preserved | quickstart.md §2/§3, contracts/seed-infrastructure-contracts.md | Command remains authoritative. |
| Idempotent rerun behavior required | Preserved | spec.md FR-002, research.md Decision 1, contracts §Seed Execution | Must be validated in tasks/tests. |
| Demo should show populated thesis/history/alerts/missions/dashboard | Preserved | spec.md User Story 1 + FR-008, plan.md Scope Preservation | Explicit demo-readiness objective. |
| NVDA thesis/history contradiction storyline | Preserved | decisions.md (inventory), spec.md FR-005/FR-008 | Concrete ticker/story kept in decisions for implementation guidance. |
| Seed concrete examples (users/holdings/watchlists/history counts) | Preserved | decisions.md inventory + contracts §Seed Baseline Minimums | Canonical spec stays neutral; concrete examples preserved here. |
| CI branch policy PR=validate, main=deploy | Preserved | contracts §CI/CD Branch Defaults, quickstart §5 | `develop` accepted as optional integration branch if configured. |
| CI runner is self-hosted Linux server Docker | Preserved | contracts §CI/CD Runner Contract | Must be encoded in workflow tasks. |
| Deploy script syncs via rsync + remote compose restart | Preserved | contracts §Deployment Script Contract | Detailed flow retained for implementation. |
| Logs helper tails named container/service | Preserved | contracts §Logs Helper Contract | Concrete usage retained. |
| Pulumi scope includes core AWS runtime resources | Preserved | contracts §IaC Resource Baseline, plan.md Manual Detail Preservation | Exact resource naming remains implementation-level. |
| `.env.example` completeness required | Preserved | spec.md FR-017, contracts §Environment Variable Contract | Must be checked by tasks. |
| Hardcoded demo credentials/text present in manual draft | Intentionally Reinterpreted | spec.md FR-009, decisions.md §Credentials | Replaced by env/config-driven values per constitution and security rules. |

## Non-Negotiable Rule For `/speckit-tasks`

`tasks.md` MUST include explicit tasks that map to every row marked "Preserved" above. Any intentional deviation requires written rationale in tasks notes.
