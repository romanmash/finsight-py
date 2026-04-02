# Research: Orchestration (008)

## Decision 1: Manager uses explicit routing table

- **Decision**: Keep a single explicit mission-type routing table as the source of truth for pipeline composition.
- **Rationale**: Prevents hidden branching and keeps behavior auditable against spec decisions.
- **Alternatives considered**:
  - Implicit routing rules inferred from prompts/config only: rejected due to drift risk.
  - Per-route hardcoded pipelines: rejected due to duplication and inconsistency.

## Decision 2: KB fast-path is hard-gated

- **Decision**: Apply fast-path only for `operator_query` when thesis is both high confidence and within freshness window.
- **Rationale**: Preserves quality and prevents stale/weak thesis from bypassing research.
- **Alternatives considered**:
  - Fast-path for medium confidence: rejected due to quality regression risk.
  - Fast-path independent of freshness: rejected due to stale-output risk.

## Decision 3: Comparison branches execute concurrently and all-or-nothing

- **Decision**: Dispatch comparison research branches concurrently; fail mission if either branch fails.
- **Rationale**: Comparison requires symmetric evidence and latency budget needs parallelism.
- **Alternatives considered**:
  - Serial collection: rejected due to latency inflation.
  - Partial comparison on single-branch success: rejected due to biased output.

## Decision 4: Confidence re-dispatch is bounded to one cycle

- **Decision**: Allow at most one re-dispatch cycle when low confidence and policy enabled.
- **Rationale**: Improves quality while preventing uncontrolled loops and cost blowups.
- **Alternatives considered**:
  - Unlimited retries: rejected due to loop/cost risk.
  - No re-dispatch: rejected because policy exists for controlled quality improvement.

## Decision 5: Route mutation guards are deterministic

- **Decision**: Ticket/alert mutation routes enforce explicit state-transition checks and role boundaries.
- **Rationale**: Prevents duplicate approvals/rejections and inconsistent state transitions.
- **Alternatives considered**:
  - Best-effort idempotence without explicit guards: rejected due to ambiguous behavior.

## Decision 6: Worker orchestration triggers mission pipelines, not ad-hoc writes

- **Decision**: Alert pipeline, daily brief, and earnings workers trigger mission flows through orchestration contracts.
- **Rationale**: Keeps observability and AgentRun accounting complete for background operations.
- **Alternatives considered**:
  - Direct worker database writes: rejected due to missing mission traceability.

## Decision 7: 006/007 compatibility checks are enforced at integration boundaries

- **Decision**: Validate 006/007 contract assumptions at manager input normalization and route/worker handoff points.
- **Rationale**: Catches contract drift early and avoids silent downstream corruption.
- **Alternatives considered**:
  - Trust upstream contracts without validation: rejected due to brittle integration.

## Decision 8: Observability link is mission-level metadata

- **Decision**: Persist trace-link metadata on Mission and expose it via mission detail APIs.
- **Rationale**: Keeps debugging entrypoint stable for dashboard and ops workflows.
- **Alternatives considered**:
  - AgentRun-only trace storage: rejected due to fragmented operator UX.
