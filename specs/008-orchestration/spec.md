# Feature Specification: Orchestration

**Feature Branch**: `008-orchestration`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "Manual 008 orchestration spec should be reviewed/fixed/extended into canonical SpecKit quality while preserving important implementation decisions."

## Scope Preservation (From Original Manual Spec)

The following implementation details from the original manual draft are intentionally preserved and must remain explicit during planning and implementation:

- **Manager orchestration detail**:
  - Manager remains the single entry point for orchestration and dispatch.
  - Manager dispatch is implemented via tool-bound orchestration calls (agent dispatch functions) rather than implicit branching.
  - The 8-intent routing table is normative and must not be replaced by hidden heuristics.
- **KB fast-path behavior detail**:
  - Fast-path applies only to `operator_query` with fresh + high-confidence thesis.
  - On fast-path hit, Researcher/Analyst dispatch is skipped for that mission path.
- **Comparison behavior detail**:
  - Comparison requests dispatch researcher branches concurrently.
  - Both branch outputs are mandatory before comparison reasoning.
- **Low-confidence recovery detail**:
  - Re-dispatch uses contradiction/open-question context from first reasoning pass.
  - Recovery is bounded (single additional cycle max).
- **API surface detail**:
  - Route scope includes: `chat`, `missions`, `kb`, `portfolio`, `watchlist`, `alerts`, `tickets`, `briefs`, and screener summary access.
  - Ticket approval path triggers explicit approval workflow only and enforces deterministic state transitions.
- **Worker detail**:
  - `alert-pipeline-worker` executes alert-investigation mission orchestration.
  - `brief-worker` generates daily-brief missions for active users.
  - `earnings-worker` evaluates earnings events and emits mission triggers.
- **Observability detail**:
  - Mission-level trace link metadata is persisted (for example `langsmithUrl`) and exposed in mission views.
  - AgentRun accounting fields remain mandatory for each pipeline step.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Classify Intent and Route Correct Pipeline (Priority: P1)

As a platform user, I want my query interpreted correctly and routed to the right mission pipeline so that I receive the expected outcome for each request type.

**Why this priority**: Without routing, no end-to-end mission can be executed reliably.

**Independent Test**: Send representative chat requests for each mission type and verify mission creation, mission type assignment, and expected pipeline execution path.

**Acceptance Scenarios**:

1. **Given** a general analysis request, **When** orchestration classifies the request, **Then** it routes to the standard analysis pipeline and returns a mission response.
2. **Given** a comparison request with two instruments, **When** orchestration classifies the request, **Then** it routes to comparison processing and returns comparison output.
3. **Given** a devil's advocate request, **When** orchestration classifies the request, **Then** it routes to contrarian analysis mode.
4. **Given** a pattern-focused request, **When** orchestration classifies the request, **Then** it routes to pattern analysis without unnecessary reasoning steps.
5. **Given** a trade-intent request, **When** orchestration classifies the request, **Then** it routes through analysis and proposal-only ticket creation.

---

### User Story 2 - Reuse Fresh High-Confidence Thesis (Priority: P1)

As a user, I want fast responses when a recent high-confidence thesis already exists so that repeated queries return quickly without full recomputation.

**Why this priority**: Fast-path behavior is a key UX and cost-control mechanism.

**Independent Test**: Seed fresh/high-confidence thesis and verify orchestration responds from KB path without full downstream pipeline dispatch.

**Acceptance Scenarios**:

1. **Given** a fresh high-confidence thesis for the requested instrument, **When** an operator query arrives, **Then** orchestration returns a KB fast-path response.
2. **Given** stale thesis data, **When** an operator query arrives, **Then** orchestration bypasses fast-path and runs the full mission pipeline.
3. **Given** non-high confidence thesis data, **When** an operator query arrives, **Then** orchestration bypasses fast-path and runs the full mission pipeline.

---

### User Story 3 - Execute Comparison Research in Parallel (Priority: P1)

As a user requesting comparisons, I want parallel upstream collection so that multi-instrument analysis completes within practical response time.

**Why this priority**: Comparison is a core workflow and must not degrade into serial latency.

**Independent Test**: Trigger comparison request and verify research steps for both instruments start concurrently and both outputs are required before reasoning proceeds.

**Acceptance Scenarios**:

1. **Given** a comparison mission with two instruments, **When** orchestration dispatches upstream collection, **Then** both collection branches start in parallel.
2. **Given** both collection branches complete successfully, **When** reasoning begins, **Then** reasoning receives both research payloads in one comparison input.
3. **Given** either collection branch fails, **When** orchestration evaluates mission continuation, **Then** mission fails explicitly with no partial comparison output.

---

### User Story 4 - Improve Low-Confidence Results via Re-dispatch (Priority: P2)

As the platform, I want optional confidence-gated re-dispatch so that low-confidence reasoning can be improved before final delivery.

**Why this priority**: Quality amplification is valuable but system can still operate without it.

**Independent Test**: Configure low-confidence re-dispatch enabled, force low confidence on first reasoning pass, and verify focused re-dispatch occurs before final output.

**Acceptance Scenarios**:

1. **Given** re-dispatch is enabled and first reasoning pass returns low confidence, **When** orchestration evaluates confidence, **Then** it triggers one focused re-dispatch cycle and reruns reasoning.
2. **Given** re-dispatch is disabled, **When** first reasoning pass returns low confidence, **Then** orchestration completes mission without re-dispatch.

---

### User Story 5 - Expose Orchestration and Domain Read APIs (Priority: P1)

As dashboard and bot consumers, I want complete route coverage for mission, KB, portfolio, watchlist, alerts, tickets, and brief surfaces so that all core UX paths are supported.

**Why this priority**: Frontend and bot workflows depend on these endpoints.

**Independent Test**: Execute route-level contract tests for mission/chat, mission history/details, KB reads, portfolio/watchlist CRUD paths, alert handling, ticket actions, and brief retrieval.

**Acceptance Scenarios**:

1. **Given** a valid chat request, **When** orchestration route receives it, **Then** a mission is created and response payload includes mission identity and response content.
2. **Given** a user requests mission history/details, **When** mission routes are called, **Then** role-scoped mission data and associated run telemetry are returned.
3. **Given** a user requests KB or brief data, **When** KB/brief routes are called, **Then** current thesis/history/search and latest brief data are returned in expected shape.
4. **Given** ticket approval/rejection actions, **When** ticket routes are called, **Then** state transitions are enforced and invalid transitions are rejected.
5. **Given** a user requests screener summary data, **When** screener route is called, **Then** latest screener summary payload is returned in expected shape.

---

### User Story 6 - Provide Mission-Level Observability (Priority: P2)

As an operator/developer, I want mission traces linked to run history so that failures and model behavior are auditable end-to-end.

**Why this priority**: Debugging and quality governance require mission-level observability.

**Independent Test**: Execute mission, verify mission stores trace link metadata, and verify mission detail responses expose trace navigation fields.

**Acceptance Scenarios**:

1. **Given** observability integration is enabled, **When** missions execute, **Then** each mission includes a trace link for run inspection.
2. **Given** mission detail retrieval, **When** response is returned, **Then** trace metadata is present for operator navigation.

---

### Compatibility Acceptance Scenarios (Priority: P1)

1. **Given** collector payloads conforming to Feature 006 contracts, **When** orchestration dispatches downstream reasoning, **Then** payloads pass through with no contract adaptation errors.
2. **Given** reasoning outputs conforming to Feature 007 contracts, **When** orchestration invokes reporting and ticket paths, **Then** downstream consumers receive contract-valid payloads.
3. **Given** contract-breaking changes in 006 or 007, **When** orchestration specs/tasks are not synchronized, **Then** the feature is not implementation-ready.

---

### Edge Cases

- If intent cannot be confidently classified, orchestration defaults to standard operator-query handling.
- If duplicate user requests arrive concurrently, each request is tracked as an independent mission.
- If mission step fails mid-pipeline, mission status moves to failed with explicit error context.
- If ticket approval is requested for an already-finalized ticket, request is rejected deterministically.
- If KB fast-path candidate exists but freshness/confidence checks fail, full pipeline execution is required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST provide a single orchestration entry point that classifies mission intent and dispatches the correct mission pipeline.
- **FR-002**: Orchestration MUST support the mission intents `operator_query`, `alert_investigation`, `comparison`, `devil_advocate`, `pattern_request`, `earnings_prebrief`, `trade_request`, and `daily_brief`.
- **FR-003**: Orchestration MUST create a mission record before pipeline execution and finalize mission status as `complete` or `failed` with error details when relevant.
- **FR-004**: For operator queries, orchestration MUST evaluate KB fast-path eligibility using thesis confidence and freshness gates before dispatching full analysis.
- **FR-005**: KB fast-path MUST be used only when thesis confidence is `high` and thesis freshness is within configured validity window.
- **FR-006**: Comparison missions MUST dispatch upstream research branches concurrently and require complete branch success before comparison reasoning.
- **FR-007**: Orchestration MUST support optional confidence-gated single re-dispatch when initial reasoning confidence is low and policy is enabled.
- **FR-008**: Confidence-gated re-dispatch MUST use contradiction/open-question context from the prior reasoning output as focused follow-up input.
- **FR-009**: Every pipeline step MUST produce an `AgentRun` record with provider/model/tokens/cost/duration and status fields.
- **FR-010**: The chat endpoint MUST create mission execution and return mission identifier plus user-facing response payload.
- **FR-011**: Mission listing/detail endpoints MUST return role-scoped mission records and associated run metadata.
- **FR-012**: KB endpoints MUST provide search, current thesis, and thesis history retrieval.
- **FR-013**: Portfolio endpoints MUST provide authenticated user portfolio retrieval and update behavior.
- **FR-014**: Watchlist endpoints MUST provide authenticated user watchlist create/read/delete behavior.
- **FR-015**: Alert endpoints MUST provide unacknowledged alert retrieval and acknowledgement operations.
- **FR-016**: Ticket endpoints MUST provide pending-ticket retrieval, approval, and rejection operations with deterministic state-transition rules.
- **FR-017**: Brief endpoint MUST provide latest brief retrieval for authenticated user context.
- **FR-029**: Screener endpoint MUST provide latest screener summary retrieval for authenticated user context.
- **FR-018**: Alert pipeline worker MUST orchestrate alert investigation through reasoning workflow and produce mission outputs.
- **FR-019**: Daily brief worker MUST schedule and generate daily brief missions for active users.
- **FR-020**: Earnings worker MUST evaluate earnings events and emit alert-worthy mission triggers.
- **FR-021**: Orchestration MUST preserve contract-based integration with Feature 006 (collector outputs) and MUST NOT depend on 006 internal implementation details.
- **FR-022**: Orchestration MUST preserve contract-based integration with Feature 007 (reasoning outputs) and MUST NOT depend on 007 internal implementation details.
- **FR-023**: Any contract-breaking change impacting 006/007/008 integration MUST be synchronized across all affected specs/tasks before implementation.
- **FR-024**: Manager dispatch behavior MUST preserve explicit tool-bound orchestration semantics for agent-step routing.
- **FR-025**: On KB fast-path hits, orchestration MUST skip Researcher/Analyst step creation for that mission path.
- **FR-026**: Ticket approval/rejection endpoints MUST enforce deterministic transition guards and reject already-finalized ticket mutations.
- **FR-027**: Orchestration worker implementations MUST include alert-pipeline, daily-brief, and earnings-trigger mission generation paths.
- **FR-028**: Mission detail surfaces MUST include mission-level trace-link metadata when observability integration is enabled.

### Mission Type -> Pipeline Routing Table

| Mission Type | Pipeline |
|---|---|
| operator_query | KB fast-path check -> Researcher -> Analyst -> Bookkeeper -> Reporter |
| alert_investigation | Researcher -> Analyst -> (optional Technician) -> Bookkeeper -> Reporter |
| comparison | Researcher x2 (parallel) -> Analyst (comparison) -> Bookkeeper x2 -> Reporter |
| devil_advocate | Researcher -> Analyst (devil_advocate) -> Bookkeeper -> Reporter |
| pattern_request | Technician -> Reporter |
| earnings_prebrief | Researcher -> Analyst -> Bookkeeper -> Reporter |
| trade_request | Researcher -> Analyst -> Bookkeeper -> Trader -> Reporter |
| daily_brief | Researcher xN -> Analyst xN -> Bookkeeper xN -> Reporter |

### Detailed Compatibility Requirements (006/007)

- **CFR-006-001**: Orchestration MUST consume collector outputs using published 006 contract shapes only.
- **CFR-006-002**: Screener trigger provenance MUST be constrained to scheduled|manual; unknown trigger values MUST be rejected.
- **CFR-006-003**: Alert-investigation routing MUST preserve minimum 006 alert-context fields when forwarding missions.
- **CFR-006-004**: TechnicalCollectionOutput.confidence MUST be treated as numeric range [0,1] in orchestration threshold/routing logic.
- **CFR-006-005**: Discovery evidence headline semantics MUST preserve supportingHeadline field expectations from 006/007 contracts.
- **CFR-007-001**: Orchestration MUST pass 007 mode contracts exactly (standard, devil_advocate, comparison) without silent mode coercion.
- **CFR-007-002**: Trade proposal paths MUST preserve 007 proposal-only safety boundary (pending_approval, no autonomous execution path).

### Requirement Clarifications

- **RC-001 (FR-004/FR-005)**: Fast-path freshness window is a configurable threshold; non-fresh records are always bypassed.
- **RC-002 (FR-007/FR-008)**: Re-dispatch scope is at most one additional cycle per mission branch to avoid unbounded loops.
- **RC-003 (FR-006)**: Comparison support in this feature is two-instrument scope unless expanded by future spec.
- **RC-004 (FR-016)**: Ticket approval/rejection routes must enforce idempotent-style rejection of invalid repeat transitions.
- **RC-005 (FR-009)**: AgentRun cost and token fields are mandatory even when values resolve to zero/unknown defaults.

### Key Entities *(include if feature involves data)*

- **MissionRequestEnvelope**: Normalized user/system trigger payload used by orchestration classifier.
- **MissionExecutionRecord**: Mission lifecycle state including type, status, trigger, input/output payloads, and completion metadata.
- **OrchestrationDecision**: Routing decision object containing mission type, selected pipeline, and fast-path/re-dispatch flags.
- **AgentRunTelemetry**: Per-step execution metadata used for auditability and cost tracking.
- **FastPathResolution**: KB lookup result containing confidence, freshness state, and selected response path.
- **TicketActionCommand**: Approval/rejection action with transition constraints and execution side effects.

## Important Decisions To Preserve

The following implementation-critical decisions from the manual draft are intentional and MUST be preserved:

- **D-001 (Single Manager Entry)**: Manager remains the sole orchestration entry point for mission routing and pipeline dispatch.
- **D-002 (Explicit Routing Table)**: Mission-type-to-pipeline mapping stays explicit and auditable, not implicit/inferred from runtime heuristics.
- **D-003 (KB Fast-Path Gate)**: Fast-path is strictly gated by high confidence and freshness threshold.
- **D-004 (Parallel Comparison Dispatch)**: Comparison branch collection is concurrent, not serial.
- **D-005 (Low-Confidence Recovery)**: Re-dispatch remains policy-controlled and bounded to avoid looping.
- **D-006 (Proposal-Only Trade Flow)**: Ticket approval path remains human-controlled; orchestration never introduces autonomous execution behavior.
- **D-007 (Contract-Only Coupling)**: 008 integrates with 006/007 through published contracts only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of supported mission intents are routed to their expected pipeline in fixture-based orchestration tests.
- **SC-002**: 100% of fast-path-eligible queries return from KB path without triggering full analysis pipeline steps.
- **SC-003**: 100% of non-eligible fast-path queries correctly fall back to full pipeline execution.
- **SC-004**: In comparison missions, upstream research branches start within <= 1 second of each other in execution telemetry.
- **SC-005**: 100% of mission runs create mission lifecycle records and per-step AgentRun telemetry with required accounting fields.
- **SC-006**: Route contract tests for mission/KB/portfolio/watchlist/alerts/tickets/briefs pass with expected role and state constraints.
- **SC-007**: Confidence-gated re-dispatch performs exactly one additional cycle when enabled and zero additional cycles when disabled.
- **SC-008**: 100% of orchestration compatibility checks enforce 006 trigger provenance and numeric confidence-range constraints in contract tests.
- **SC-009**: Screener summary route contract tests pass with expected role and response-shape constraints.

## Requirement Traceability

- **TR-001**: Routing/core orchestration requirements (`FR-001`..`FR-009`) are covered by User Stories 1-4 and `SC-001`..`SC-005`, `SC-007`.
- **TR-002**: API surface requirements (`FR-010`..`FR-017`, `FR-029`) are covered by User Story 5 and `SC-006`, `SC-009`.
- **TR-003**: Worker/orchestration automation requirements (`FR-018`..`FR-020`) are covered by User Story 1/6 and `SC-005`.
- **TR-004**: Cross-feature contract requirements (`FR-021`..`FR-023`) are covered by Compatibility Acceptance Scenarios and `SC-001`, `SC-006`, `SC-008`.

## Contract Evolution Protocol

- **CEP-001**: Contract-breaking changes in collector or reasoning interfaces require synchronized updates across `specs/006-collector-agents`, `specs/007-reasoning-agents`, and `specs/008-orchestration` before implementation.
- **CEP-002**: Synchronization updates must include `spec.md`, `plan.md`, `tasks.md`, and contract artifacts for affected features.
- **CEP-003**: No implementation proceeds when cross-feature contract mismatches are unresolved in specification artifacts.

## Implementation Readiness Preconditions

- **PRC-001**: Feature 006 contract artifacts are finalized and validated for consumption.
- **PRC-002**: Feature 007 reasoning contracts are finalized and validated for orchestration handoff.
- **PRC-003**: Runtime configuration for routing, confidence policy, scheduling, and role protections is available and valid.

## Assumptions

- Existing authentication and role-guard behavior from prior features remains available to protect route surfaces.
- Mission and AgentRun persistence models remain the source of truth for orchestration audit history.
- Scheduling infrastructure is available for worker-triggered orchestration flows.
- Integration behavior with external providers remains configurable and can be mocked for offline validation.
