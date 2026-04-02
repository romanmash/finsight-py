# Feature Specification: Reasoning Agents

**Feature Branch**: `007-reasoning-agents`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "Review/fix/extend the manually written 007 spec to canonical SpecKit quality while preserving important implementation decisions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Synthesize Actionable Thesis (Priority: P1)

As a mission consumer, I need raw collection evidence transformed into a clear investment thesis with confidence and risks so that I can act on conclusions instead of parsing raw signals.

**Why this priority**: This is the core product value of reasoning in FinSight and is required in most mission flows.

**Independent Test**: Provide valid upstream research payloads and verify the reasoning output is structurally valid, includes thesis/evidence/risks/confidence, and supports all defined reasoning modes.

**Acceptance Scenarios**:

1. **Given** valid research payloads for one instrument, **When** the reasoning flow runs in standard mode, **Then** it returns a thesis update with supporting evidence, risk factors, and confidence with explanation.
2. **Given** valid research payloads and an explicit challenge request, **When** the reasoning flow runs in devil's advocate mode, **Then** it returns a counter-thesis style analysis using dedicated mode behavior.
3. **Given** valid research payloads for two instruments, **When** the reasoning flow runs in comparison mode, **Then** it returns a structured comparison output in addition to analysis fields.
4. **Given** a user portfolio position in the instrument, **When** reasoning runs, **Then** portfolio context is reflected in the resulting analysis.
5. **Given** malformed model output, **When** reasoning validation fails, **Then** the flow retries once and fails explicitly if still invalid.

---

### User Story 2 - Preserve Thesis Memory and Contradictions (Priority: P1)

As the platform memory layer, I need every thesis update to be persisted with history and contradiction checks so that reasoning remains auditable and searchable over time.

**Why this priority**: Without this memory workflow, downstream retrieval, contradiction alerts, and thesis history commands do not work.

**Independent Test**: Submit new and updated thesis outputs and verify current entry persistence, snapshot creation rules, contradiction outcomes, and transaction safety.

**Acceptance Scenarios**:

1. **Given** no prior thesis for a symbol, **When** a thesis is stored, **Then** a new knowledge entry is created with change type `initial`.
2. **Given** a prior thesis exists, **When** a new thesis is stored, **Then** the prior thesis is snapshotted before overwrite.
3. **Given** contradiction detection returns high severity, **When** persistence completes, **Then** a contradiction alert is created and linked to the update.
4. **Given** contradiction detection returns low or none, **When** persistence completes, **Then** no contradiction alert is created.
5. **Given** the persistence transaction fails, **When** write operations are rolled back, **Then** no partial thesis/snapshot/alert state remains.

---

### User Story 3 - Deliver Readable Mission Output (Priority: P1)

As a Telegram user, I need reasoning outputs converted into concise, labeled messages so that mission results are understandable and consumable in chat.

**Why this priority**: This is the direct user-facing result path for reasoning missions.

**Independent Test**: Provide structured mission outputs and verify delivery formatting, labeling behavior, fallback behavior, and long-message splitting.

**Acceptance Scenarios**:

1. **Given** a completed reasoning output, **When** delivery runs, **Then** a labeled formatted message is sent to the user.
2. **Given** the primary formatter is unavailable, **When** delivery runs, **Then** a configured fallback formatter is used without dropping output.
3. **Given** a daily brief mission output, **When** delivery runs, **Then** the result is both delivered and recorded in the daily brief record.
4. **Given** a formatted message exceeds chat length limits, **When** delivery runs, **Then** the message is split into valid sequential chunks.

---

### User Story 4 - Propose Human-Approved Trade Tickets (Priority: P2)

As a user, I need trade suggestions represented as approval-required tickets so that I can make final decisions while the system remains non-autonomous.

**Why this priority**: Ticketing is valuable but secondary to analysis, memory, and delivery.

**Independent Test**: Submit valid and invalid trade intents and verify ticket creation rules, rationale quality, and mandatory human-approval safeguards.

**Acceptance Scenarios**:

1. **Given** a valid trade intent and sufficient supporting analysis, **When** ticket creation runs, **Then** a pending-approval ticket is created.
2. **Given** a created ticket, **When** rationale is generated, **Then** rationale contains exactly three sentences grounded in available analysis.
3. **Given** any proposed ticket, **When** it is presented, **Then** it always includes explicit human-approval warning text.
4. **Given** a sell request for a non-held position, **When** ticket creation runs, **Then** the request is rejected with a clear error.

---

### Compatibility Acceptance Scenarios (Priority: P1)

1. **Given** collector payloads that match Feature 006 published contracts, **When** reasoning inputs are validated, **Then** processing continues using the expected field and type semantics.
2. **Given** collector payloads with non-conforming contract fields or incompatible value types, **When** reasoning validation runs, **Then** processing fails explicitly with a contract-mismatch error.
3. **Given** technical confidence values from collector outputs, **When** reasoning consumes them, **Then** values are interpreted only as numeric range `[0,1]`.
4. **Given** discovery evidence headlines in collector output, **When** reasoning consumes the payload, **Then** `supportingHeadline` is used as the canonical field.

---

### Edge Cases

- How should reasoning behave when mission-level re-dispatch conditions are met due to low confidence? This remains owned by orchestration (Feature 008), not by reasoning agent internals.
- What happens if embedding output shape is invalid? The update must be rejected rather than storing unusable vector state.
- What happens if chat delivery fails after reasoning succeeded? Mission completion remains valid, while delivery failure is logged for retry/operations handling.
- What happens if contradiction detection succeeds but persistence fails? Alert and thesis updates must not be committed partially.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST provide four reasoning-side capabilities: thesis synthesis, thesis bookkeeping, user-facing reporting, and trade ticket proposal.
- **FR-002**: Thesis synthesis MUST support `standard`, `devil_advocate`, and `comparison` reasoning modes.
- **FR-003**: Thesis synthesis MUST support a portfolio-aware behavior path when the user holds the analyzed instrument.
- **FR-004**: Thesis synthesis output MUST be schema-validated; on invalid output the system MUST retry once before returning an explicit failure.
- **FR-005**: Thesis synthesis MUST operate without direct external tool calls during analysis generation.
- **FR-006**: Knowledge bookkeeping MUST retrieve prior thesis state before writing updates.
- **FR-007**: Knowledge bookkeeping MUST create a thesis snapshot before overwrite for non-initial updates.
- **FR-008**: Knowledge bookkeeping MUST classify updates as one of: `initial`, `update`, `contradiction`, `devil_advocate`.
- **FR-009**: Knowledge bookkeeping MUST run contradiction evaluation and create contradiction alerts only for high-severity outcomes.
- **FR-010**: Knowledge bookkeeping MUST persist thesis updates and related history atomically in a single transaction.
- **FR-011**: Knowledge bookkeeping MUST require successful embedding generation for persisted thesis entries.
- **FR-012**: Reporting MUST format structured reasoning outputs into mission-type-aware labeled user messages.
- **FR-013**: Reporting MUST deliver mission outputs through chat and split messages that exceed platform length constraints.
- **FR-014**: Reporting MUST support configured formatter fallback behavior when the primary formatter is unavailable.
- **FR-015**: Reporting MUST persist daily brief records when handling daily brief mission outputs.
- **FR-016**: Trade proposal MUST retrieve current thesis context before ticket construction.
- **FR-017**: Trade proposal MUST generate a rationale of exactly three sentences.
- **FR-018**: Trade proposal MUST create pending-approval tickets and never execute trades autonomously.
- **FR-019**: Trade proposal MUST include explicit human-approval warning text in every proposed ticket.
- **FR-020**: Trade proposal MUST reject sell proposals for instruments not currently held by the user.
- **FR-021**: This feature MUST consume collector outputs from Feature 006 strictly by published contract shape and value types.
- **FR-022**: This feature MUST treat technical collector confidence as numeric range `[0,1]`.
- **FR-023**: This feature MUST consume discovery evidence headline fields using `supportingHeadline`.
- **FR-024**: Any collector contract-breaking change that impacts this feature MUST be synchronized across Features 006, 007, and 008 before implementation.

### Requirement Clarifications

- **RC-001 (FR-004)**: Schema validation failure includes any JSON parse failure, missing required fields, wrong field types, or enum mismatch. Exactly one retry is allowed; a second failure is terminal for that reasoning step.
- **RC-002 (FR-005)**: "Without direct external tool calls" means no MCP tool invocation and no tool-binding execution during Analyst synthesis. Local deterministic helpers (format/validation/transforms) are allowed.
- **RC-003 (FR-009)**: Contradiction alerts are created only when contradiction severity is `high`; `low` and `none` explicitly do not create contradiction alerts.
- **RC-004 (FR-013)**: Platform length constraint is Telegram maximum message size of 4096 characters per message; chunking must preserve ordering and not drop content.
- **RC-005 (FR-017)**: "Exactly three sentences" is validated by project sentence-boundary rules and MUST evaluate to three non-empty sentences before ticket creation completes.
- **RC-006 (FR-020)**: "Non-held position" means current holdings quantity for the instrument is `<= 0` at ticket-creation time, using portfolio data as the source of truth.
- **RC-007 (FR-002)**: Comparison mode in this feature requires exactly two instruments; other cardinalities are out of scope and must be rejected explicitly.
- **RC-008 (FR-013/FR-014)**: Reporter delivery failure after formatting is non-fatal to mission reasoning completion; retry ownership is orchestration/worker level (Feature 008).

### Key Entities *(include if feature involves data)*

- **Reasoning Analysis Output**: Structured thesis result containing thesis update, evidence, risk factors, confidence, and mode-specific additions such as comparison output.
- **Knowledge Base Entry**: Current thesis record for an instrument, including update metadata, contradiction state, and retrieval-ready embedding.
- **Thesis Snapshot**: Historical immutable version of a prior thesis captured before overwrite on non-initial updates.
- **Contradiction Alert**: Escalation record produced when a new thesis materially conflicts with prior thesis state.
- **Formatted Mission Report**: User-facing, labeled output prepared for chat delivery and bounded by message length rules.
- **Trade Ticket Proposal**: Approval-required trade intent containing action details, rationale, and explicit non-autonomous warning.

## Important Decisions To Preserve

The following decisions are intentional and MUST be preserved in planning and implementation:

- **D-001 (Analyst isolation)**: The analysis capability is tool-free during reasoning generation.
- **D-002 (Reasoning modes)**: Three explicit modes are required: standard, devil's advocate, comparison.
- **D-003 (Bookkeeping safety)**: Thesis overwrite protection via pre-overwrite snapshot and transactional writes is mandatory.
- **D-004 (Contradiction policy)**: Only high-severity contradictions create contradiction alerts.
- **D-005 (Reporter fallback)**: Delivery formatting must use primary formatter with automatic configured fallback.
- **D-006 (Trade control)**: Trade outputs are proposals only, always pending human approval, never autonomous execution.
- **D-007 (Collector compatibility)**: Feature 007 depends on 006 contracts, not on 006 internal implementation style.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of standard-mode reasoning runs in test fixtures return schema-valid thesis outputs with confidence and risk fields.
- **SC-002**: 100% of comparison-mode fixtures return comparison output in the expected structure.
- **SC-003**: 100% of non-initial thesis updates create exactly one snapshot before overwrite.
- **SC-004**: 100% of high-severity contradiction fixtures create contradiction alerts; 0% of low/none fixtures create contradiction alerts.
- **SC-005**: 100% of persisted thesis entries include valid embeddings; failed embeddings result in rejected persistence.
- **SC-006**: 100% of reporting outputs deliver labeled chat messages, with split behavior for oversized messages.
- **SC-007**: 100% of trade tickets created by this feature are `pending_approval` and include explicit human-approval warning text.
- **SC-008**: 100% of invalid sell-for-non-held fixtures are rejected with deterministic error responses.

## Requirement Traceability

- **TR-001**: Analyst synthesis requirements (`FR-002`..`FR-005`) are covered by User Story 1 scenarios and `SC-001`, `SC-002`.
- **TR-002**: Bookkeeper memory requirements (`FR-006`..`FR-011`) are covered by User Story 2 scenarios and `SC-003`, `SC-004`, `SC-005`.
- **TR-003**: Reporter delivery requirements (`FR-012`..`FR-015`) are covered by User Story 3 scenarios and `SC-006`.
- **TR-004**: Trader proposal requirements (`FR-016`..`FR-020`) are covered by User Story 4 scenarios and `SC-007`, `SC-008`.
- **TR-005**: Collector compatibility requirements (`FR-021`..`FR-024`) are covered by Compatibility Acceptance Scenarios and plan/tasks compatibility phases.

## Contract Evolution Protocol

- **CEP-001**: Contract-breaking changes to collector payloads are owned by the feature author introducing the change and require synchronized updates to `specs/006-collector-agents`, `specs/007-reasoning-agents`, and `specs/008-orchestration`.
- **CEP-002**: Synchronization updates must include `spec.md`, `plan.md`, `tasks.md`, and affected contract files before implementation merge.
- **CEP-003**: Contract change validation must include explicit checklist coverage and cross-feature review confirmation before implementation proceeds.

## Implementation Readiness Preconditions

- **PRC-001**: Feature 005 runtime dependencies are present and validated in local/offline test context.
- **PRC-002**: Feature 006 contract artifacts are available and unchanged from referenced compatibility assumptions, or updated per Contract Evolution Protocol.
- **PRC-003**: Feature 008 ownership boundaries (re-dispatch/retry orchestration) are acknowledged and unchanged for this feature scope.

## Assumptions

- Feature 005 infrastructure (agent runtime, model routing, telemetry, and MCP client wiring) is available and stable.
- Feature 006 collector contracts are the authoritative source for upstream payload shape consumed by this feature.
- Orchestration-level retries, re-dispatch, and mission graph branching remain owned by Feature 008.
- Chat delivery integration exists and is available as a platform capability; this feature defines reasoning-side formatting and delivery behavior only.
- Environment-specific provider/model selections remain configurable outside source code, consistent with project constitution.

