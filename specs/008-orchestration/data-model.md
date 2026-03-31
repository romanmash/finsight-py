# Data Model: Orchestration (008)

## Overview

This model defines orchestration-side entities, lifecycle transitions, and handoff payloads used to execute and observe mission pipelines.

## Entities

### 1) MissionRequestEnvelope

- **Purpose**: Normalized request payload entering orchestration from chat routes or workers.
- **Core fields**:
  - `userId` (optional for system-triggered missions)
  - `triggerType` (`user`, `scheduled`, `alert`)
  - `message` (optional natural-language request)
  - `tickers` (optional list)
  - `context` (optional structured metadata)
- **Validation rule**: Must contain enough fields to determine mission type and dispatch context.

### 2) OrchestrationDecision

- **Purpose**: Routing output from Manager classification stage.
- **Core fields**:
  - `missionType`
  - `pipelineSteps[]`
  - `fastPathEligible` (boolean)
  - `reDispatchAllowed` (boolean)
- **Validation rule**: `missionType` must map to an explicit route-table pipeline.

### 3) MissionExecutionRecord

- **Purpose**: Mission lifecycle record persisted before, during, and after pipeline execution.
- **Backed by**: `Mission` model.
- **Relevant fields**:
  - `id`, `userId`, `type`, `status`, `trigger`
  - `inputData`, `outputData`, `tickers`
  - `createdAt`, `completedAt`
- **State rule**: transitions from `pending|running` to terminal `complete|failed`.

### 4) AgentRunTelemetry

- **Purpose**: Per-step execution accounting and diagnostics.
- **Backed by**: `AgentRun` model.
- **Relevant fields**:
  - `missionId`, `agentName`, `provider`, `model`
  - `tokensIn`, `tokensOut`, `costUsd`, `durationMs`
  - `status`, `errorMessage`, `inputData`, `outputData`
- **Validation rule**: accounting fields are present (zero allowed where policy defines).

### 5) FastPathResolution

- **Purpose**: Encapsulates KB fast-path lookup outcome.
- **Runtime fields**:
  - `hit` (boolean)
  - `confidence` (`low|medium|high`)
  - `isFresh` (boolean)
  - `source` (`kb_fast_path` or `pipeline`)
- **State rule**: only `hit && confidence=high && isFresh` allows fast-path response.

### 6) TicketActionCommand

- **Purpose**: Route-level action request for trade ticket approval/rejection.
- **Core fields**:
  - `ticketId`
  - `action` (`approve|reject`)
  - `actorUserId`
  - `reason` (optional for rejection)
- **Validation rule**: only pending tickets may transition; finalized tickets reject mutation.

### 7) WorkerMissionTrigger

- **Purpose**: Standardized payload for background worker-initiated missions.
- **Core fields**:
  - `workerType` (`alert_pipeline|daily_brief|earnings`)
  - `triggeredAt`
  - `targetUsers[]` or `targetTickers[]`
  - `missionSeedData`
- **State rule**: worker dispatch produces missions with full mission/run observability.

## Relationships

- `MissionRequestEnvelope` -> `OrchestrationDecision` -> `MissionExecutionRecord`.
- `MissionExecutionRecord` has many `AgentRunTelemetry` records.
- `FastPathResolution` can short-circuit mission step expansion but still results in mission output.
- `TicketActionCommand` updates ticket state and may trigger external execution path with audit trail.
- `WorkerMissionTrigger` feeds manager orchestration via mission creation pipeline.

## State Transitions

### Mission Lifecycle

1. Create mission record (`pending` or `running`).
2. Classify intent and build dispatch plan.
3. Execute steps (or fast-path shortcut).
4. Persist output.
5. Finalize mission as `complete` or `failed`.

### Low-Confidence Re-dispatch

1. Initial reasoning returns low confidence.
2. If policy enabled, run one focused re-dispatch cycle.
3. Re-run reasoning with focused context.
4. Continue pipeline with final result (no additional loops).

### Ticket Action Lifecycle

1. Receive approve/reject action.
2. Validate current ticket status.
3. Apply transition and side effects.
4. Reject invalid repeat/finalized transitions.
