# Tasks: Seed & Infrastructure Readiness

**Input**: Design documents from `/specs/011-seed-infrastructure/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Automated and contract-validation tasks are included for seed idempotency, CI branch gating, deploy/log scripts, and env-contract completeness.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare repository structure and executable validation scaffolding for 011.

- [x] T001 Create 011 baseline directories and placeholders in `infra/pulumi/`, `.github/workflows/`, and `scripts/`
- [x] T002 [P] Add workspace scripts for seed/deploy verification in `package.json`
- [x] T003 [P] Add or update Pulumi package metadata in `infra/pulumi/Pulumi.yaml`
- [x] T004 [P] Create validation scaffolding directories in `prisma/__tests__/`, `scripts/__tests__/`, and `tools/validation/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core prerequisites that block all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Implement parity coverage audit script in `tools/validation/check-011-parity.mjs`
- [x] T006 [P] Add seed configuration contract fields and comments in `.env.example`
- [x] T007 [P] Add deployment configuration contract fields and comments in `.env.example`
- [x] T008 [P] Add CI/deploy branch defaults and runner assumptions in `.github/workflows/ci-cd.yml`
- [x] T009 [P] Add script usage headers and strict shell safety options in `scripts/deploy.sh` and `scripts/logs.sh`
- [x] T010 Add seed run result logging contract scaffold in `prisma/seed.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Demo Data Bootstrap (Priority: P1) 🎯 MVP

**Goal**: Provide deterministic, idempotent seed data for all demo-critical domains.

**Independent Test**: Run `pnpm prisma db seed` twice and verify no duplicate conflicts; verify demo-critical reads return populated data.

### Tests for User Story 1

- [x] T011 [P] [US1] Add automated seed idempotency test in `prisma/__tests__/seed-idempotency.test.ts`
- [x] T012 [P] [US1] Add automated seeded-domain presence test in `prisma/__tests__/seed-baseline.test.ts`
- [x] T013 [US1] Add seed test runner wiring in `package.json`

### Implementation for User Story 1

- [x] T014 [US1] Implement seed entrypoint and Prisma client bootstrap in `prisma/seed.ts`
- [x] T015 [P] [US1] Implement environment-driven admin credential sourcing in `prisma/seed.ts`
- [x] T016 [P] [US1] Implement analyst persona seed logic in `prisma/seed.ts`
- [x] T017 [P] [US1] Implement portfolio/watchlist seed reconciliation (including preserved examples) in `prisma/seed.ts`
- [x] T018 [P] [US1] Implement KB current thesis seed with embedding-aware preconditions in `prisma/seed.ts`
- [x] T019 [P] [US1] Implement KB thesis-history seed with 4-step timeline and contradiction transition in `prisma/seed.ts`
- [x] T020 [P] [US1] Implement screener-run seed records with deterministic sample findings in `prisma/seed.ts`
- [x] T021 [P] [US1] Implement alert seed records with upcoming earnings-related high severity entry in `prisma/seed.ts`
- [x] T022 [P] [US1] Implement prior mission + AgentRun seed records in `prisma/seed.ts`
- [x] T023 [P] [US1] Implement ingested-document baseline seed records (minimum three entries) in `prisma/seed.ts`
- [x] T024 [US1] Implement idempotent upsert/reconcile strategy with stable keys across all seeded domains in `prisma/seed.ts`
- [x] T025 [US1] Implement fail-fast preflight checks (migrations/tables/config dependencies) in `prisma/seed.ts`
- [x] T026 [US1] Implement structured seed outcome summary (`created`, `updated`, `warnings`) in `prisma/seed.ts`
- [x] T027 [US1] Document concrete API verification examples in `specs/011-seed-infrastructure/quickstart.md`
- [x] T028 [US1] Add seed baseline verification matrix (entities + expected minimums) in `specs/011-seed-infrastructure/contracts/seed-infrastructure-contracts.md`

**Checkpoint**: User Story 1 is independently functional and demo-ready.

---

## Phase 4: User Story 2 - Delivery Automation and Deployability (Priority: P1)

**Goal**: Enforce CI quality gates and branch-gated deploy behavior on self-hosted runner.

**Independent Test**: PR to integration branch runs validation-only stages; push to main runs deploy stage only after gate success.

### Tests for User Story 2

- [x] T029 [P] [US2] Add workflow policy validation script in `tools/validation/validate-ci-cd-policy.mjs`
- [x] T030 [P] [US2] Add workflow stage-order test fixture in `scripts/__tests__/ci-cd-order.test.ts`

### Implementation for User Story 2

- [x] T031 [US2] Implement staged CI workflow with ordered gates in `.github/workflows/ci-cd.yml`
- [x] T032 [P] [US2] Configure `develop` integration-branch PR trigger behavior (validation-only) in `.github/workflows/ci-cd.yml`
- [x] T033 [P] [US2] Configure `main` push behavior (deploy-capable) in `.github/workflows/ci-cd.yml`
- [x] T034 [US2] Configure self-hosted Linux runner execution and Docker-capability assumptions in `.github/workflows/ci-cd.yml`
- [x] T035 [US2] Configure gate failure stop conditions so deploy is blocked on earlier stage failure in `.github/workflows/ci-cd.yml`
- [x] T036 [US2] Add workflow summary/logging outputs for gate and deploy outcomes in `.github/workflows/ci-cd.yml`
- [x] T037 [US2] Add CI gate-order verification criteria in `specs/011-seed-infrastructure/contracts/seed-infrastructure-contracts.md`
- [x] T038 [US2] Add branch-trigger verification steps in `specs/011-seed-infrastructure/quickstart.md`

**Checkpoint**: User Story 2 is independently functional with enforceable CI/CD policy.

---

## Phase 5: User Story 3 - Operator Deployment Control (Priority: P2)

**Goal**: Provide robust remote deploy and logs scripts for operational use.

**Independent Test**: `scripts/deploy.sh` syncs + restarts + validates health; `scripts/logs.sh <service>` tails named service logs.

### Tests for User Story 3

- [x] T039 [P] [US3] Add deploy script contract test in `scripts/__tests__/deploy-contract.test.ts`
- [x] T040 [P] [US3] Add logs script contract test in `scripts/__tests__/logs-contract.test.ts`

### Implementation for User Story 3

- [x] T041 [US3] Implement deploy preflight checks (required args/env/tools) in `scripts/deploy.sh`
- [x] T042 [US3] Implement artifact synchronization to remote host via rsync in `scripts/deploy.sh`
- [x] T043 [US3] Implement remote compose restart/update via SSH in `scripts/deploy.sh`
- [x] T044 [US3] Implement post-deploy health checks for required services in `scripts/deploy.sh`
- [x] T045 [US3] Implement deterministic non-zero exits and actionable error messages in `scripts/deploy.sh`
- [x] T046 [US3] Implement logs helper argument validation and targeted remote log tailing in `scripts/logs.sh`
- [x] T047 [US3] Add deploy-script stage verification checklist in `specs/011-seed-infrastructure/contracts/seed-infrastructure-contracts.md`
- [x] T048 [US3] Add logs-helper usage and failure-mode checks in `specs/011-seed-infrastructure/quickstart.md`

**Checkpoint**: User Story 3 is independently functional for deployment and diagnostics.

---

## Phase 6: User Story 4 - Configuration and Environment Completeness (Priority: P2)

**Goal**: Deliver complete environment contract and IaC preview/provision baseline.

**Independent Test**: Populated `.env` passes startup requirements; Pulumi preview resolves planned resources without fatal errors.

### Tests for User Story 4

- [x] T049 [P] [US4] Add env-contract completeness validation script in `tools/validation/validate-env-contract.mjs`
- [x] T050 [P] [US4] Add Pulumi preview smoke validation script in `tools/validation/validate-pulumi-preview.mjs`

### Implementation for User Story 4

- [x] T051 [US4] Implement Pulumi stack baseline (network/compute/data/registry/ingress) and define deployment healthcheck targets for SC-005 evidence in `infra/pulumi/index.ts`
- [x] T052 [P] [US4] Add environment-specific Pulumi config template in `infra/pulumi/Pulumi.dev.yaml`
- [x] T053 [US4] Finalize `.env.example` with required seed/runtime/deploy variables and semantic comments in `.env.example`
- [x] T054 [US4] Add 011 environment/deploy setup guidance in `docs/SETUP.md`
- [x] T055 [US4] Add env-contract completeness and placeholder-only checks in `specs/011-seed-infrastructure/contracts/seed-infrastructure-contracts.md`
- [x] T056 [US4] Add Pulumi preview validation steps in `specs/011-seed-infrastructure/quickstart.md`

**Checkpoint**: User Story 4 is independently functional for onboarding and infrastructure preview.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final parity checks, measurable SC evidence, and readiness validation.

- [x] T057 [P] Verify manual parity mapping coverage and update `specs/011-seed-infrastructure/manual-parity.md` if needed
- [x] T058 [P] Align preserved decisions and contracts wording consistency in `specs/011-seed-infrastructure/decisions.md` and `specs/011-seed-infrastructure/contracts/seed-infrastructure-contracts.md`
- [x] T059 Define SC-005 measurement method (5-minute window, >=20 deployment sample) and evidence capture template using deploy healthcheck outputs in `specs/011-seed-infrastructure/quickstart.md`
- [x] T060 Run full workspace quality gates (`pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test -- --pool=threads`) and capture results in `specs/011-seed-infrastructure/quickstart.md`
- [x] T061 Run secret policy verification (`pnpm check:secrets`) and confirm no hardcoded secrets in modified files
- [ ] T062 Execute end-to-end 011 quickstart validation and update operational notes in `specs/011-seed-infrastructure/quickstart.md`
- [x] T063 Execute parity audit script and attach pass/fail results in `specs/011-seed-infrastructure/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all story implementation.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2; can proceed in parallel with US1 if resourced.
- **Phase 5 (US3)**: Depends on Phase 2; can proceed in parallel with US1/US2.
- **Phase 6 (US4)**: Depends on Phase 2; can proceed in parallel with US1/US2/US3.
- **Phase 7 (Polish)**: Depends on completion of desired user stories.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational.
- **US2 (P1)**: Independent after Foundational.
- **US3 (P2)**: Independent after Foundational, integrates CI/deploy assumptions from US2.
- **US4 (P2)**: Independent after Foundational, aligns with IaC/deploy contract.

### Within Each User Story

- Tests and validation scripts first.
- Contract/data shaping before behavior wiring.
- Deterministic failure handling before story completion sign-off.

### Parallel Opportunities

- Setup: T002, T003, T004
- Foundational: T006, T007, T008, T009
- US1: T015..T023 can run in parallel after T014; then converge at T024/T025/T026
- US2: T032, T033, T034 after T031
- US3: T042, T043, T044 after T041
- US4: T052, T053 after T051
- Polish: T057, T058, T059 in parallel

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 + Phase 2
2. Complete Phase 3 (US1)
3. Validate idempotent seed + demo read-path population
4. Demo baseline is usable before deploy automation is finalized

### Incremental Delivery

1. US1: Demo data readiness
2. US2: CI/CD enforcement
3. US3: Operator deploy/log tooling
4. US4: Env + IaC readiness
5. Polish: parity, SC evidence, full-gate validation

### Parity Enforcement

- Every preserved row in `manual-parity.md` must map to at least one task above.
- Any intentional omission requires explicit rationale in final implementation notes.

---

## Notes

- `[P]` tasks indicate parallelizable work with minimal dependency coupling.
- Story labels (`[US1]..[US4]`) ensure traceability from tasks to spec priorities.
- No hardcoded secrets are permitted in seed, workflows, or scripts.
- This task list is designed for direct execution by `/speckit-implement`.




