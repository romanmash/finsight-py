# Feature Specification: Reasoning Agents

**Feature Branch**: `007-reasoning-agents`
**Created**: 2026-04-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Analyst Produces a Structured Assessment from a Research Packet (Priority: P1)

The Manager passes a Research Packet (assembled by the Researcher) to the Analyst. The Analyst
synthesises the evidence, explains why a price move or event matters in context, assesses
whether the available evidence supports or contradicts the operator's existing thesis for that
asset, and produces a structured Assessment. The Analyst does not fetch any data — it reasons
only from what is in the Research Packet.

**Why this priority**: The Analyst is the core reasoning engine. Without it, the system can
detect events but cannot explain them or connect them to the operator's thesis.

**Independent Test**: Provide a Research Packet to the Analyst, verify the returned Assessment
contains an explanation, a thesis impact rating, and a risk summary, and verify no external tool
calls were made during the run.

**Acceptance Scenarios**:

1. **Given** a Research Packet, **When** the Analyst runs, **Then** it returns a structured
   Assessment containing an explanation of significance, a thesis support/contradiction rating,
   and an identified risk summary.
2. **Given** conflicting signals in the Research Packet (e.g., positive fundamentals but
   negative news), **When** the Analyst runs, **Then** the Assessment reflects the conflict and
   explains the tension rather than ignoring one side.
3. **Given** a Research Packet with no relevant news or unusual signals, **When** the Analyst
   runs, **Then** the Assessment reports no significant change with a brief supporting rationale.

---

### User Story 2 — Pattern Specialist Identifies Technical Patterns in Price Data (Priority: P1)

The Pattern Specialist receives historical price and volume data for an asset (from the Research
Packet) and analyses the technical structure. It identifies any notable patterns (trend, reversal,
accumulation, breakout) and reports them with a confidence level and supporting observations. It
explicitly does not provide investment advice — it describes what the pattern data shows.

**Why this priority**: Technical pattern recognition adds a distinct analytical dimension that
complements the Analyst's fundamental and news-based reasoning.

**Independent Test**: Provide a price history with a recognisable technical pattern, verify the
Pattern Specialist identifies and names the pattern, verify confidence levels are included, and
verify no investment recommendations appear in the output.

**Acceptance Scenarios**:

1. **Given** price history containing a recognisable technical pattern, **When** the Pattern
   Specialist runs, **Then** it returns a Pattern Report naming the pattern, describing the
   supporting observations, and assigning a confidence level.
2. **Given** price history with no clear pattern, **When** the Pattern Specialist runs, **Then**
   it returns a Pattern Report noting the absence of a clear pattern rather than forcing an
   identification.
3. **Given** a Pattern Specialist output, **When** inspected, **Then** it contains no investment
   advice or buy/sell signals — only technical observations.

---

### User Story 3 — Bookkeeper Writes a Curated Knowledge Entry to the Shared Knowledge Base (Priority: P1)

After an investigation completes, the Manager passes the consolidated outputs (Assessment, Pattern
Report, mission summary) to the Bookkeeper. The Bookkeeper reviews for duplicates, resolves
conflicts with existing entries, attaches provenance (source agent, mission ID, confidence,
freshness), and writes one or more curated entries to the knowledge base. It is the only agent
that writes to the knowledge base.

**Why this priority**: The Bookkeeper is the guardian of the shared knowledge base. Without it,
insights are lost after each run and the system cannot accumulate compound intelligence.

**Independent Test**: Provide a set of agent outputs to the Bookkeeper, verify a knowledge entry
is written with correct provenance, run again with similar content and verify deduplication logic
produces a single updated entry rather than a duplicate.

**Acceptance Scenarios**:

1. **Given** new agent outputs, **When** the Bookkeeper runs, **Then** a knowledge entry is
   written with source attribution, mission reference, confidence score, and freshness timestamp.
2. **Given** an existing knowledge entry for the same entity, **When** the Bookkeeper receives
   updated information, **Then** it updates the existing entry rather than creating a duplicate,
   and the previous version's provenance is preserved.
3. **Given** conflicting information from two sources, **When** the Bookkeeper processes both,
   **Then** the conflict is flagged in the entry rather than silently resolved in favour of one
   source.

---

### User Story 4 — Reporter Formats Agent Outputs for Delivery (Priority: P2)

The Reporter receives structured outputs from the Analyst, Pattern Specialist, and Bookkeeper
and formats them into human-readable summaries for delivery via Telegram or display on the
dashboard. The Reporter does not analyse or interpret — it only formats the content it receives.

**Why this priority**: The Reporter is the final step before operator delivery. Without it,
agent outputs remain as raw structured data that the operator cannot easily consume.

**Independent Test**: Provide structured agent outputs to the Reporter, verify the output is a
readable summary containing all key points, and verify no new analytical content was added.

**Acceptance Scenarios**:

1. **Given** a completed Assessment and Pattern Report, **When** the Reporter runs, **Then** it
   produces a readable summary covering key findings without omitting critical information.
2. **Given** a Reporter output, **When** inspected, **Then** it contains only formatted
   representations of its inputs — no new analysis, conclusions, or recommendations.

---

### Edge Cases

- What happens when the Analyst receives a Research Packet with critical fields missing?
- How does the Bookkeeper handle a knowledge base write failure mid-transaction?
- What if the Pattern Specialist receives price history that is too short to identify patterns?
- How does the Reporter handle an empty or minimal input (e.g., a mission with no findings)?
- What if the Bookkeeper detects that an incoming update directly contradicts a high-confidence
  existing entry?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Analyst MUST accept a Research Packet as its sole input and MUST NOT make any
  external tool calls; it reasons only from the provided data.
- **FR-002**: The Analyst MUST produce a typed Assessment containing: a significance explanation,
  a thesis impact rating (supports/contradicts/neutral), identified risks, and a confidence level.
- **FR-003**: The Pattern Specialist MUST accept price and volume history as input and return a
  typed Pattern Report containing: identified pattern name (or absence indicator), supporting
  observations, and a confidence level.
- **FR-004**: The Pattern Specialist MUST NOT include investment advice, buy/sell signals, or
  price targets in its output.
- **FR-005**: The Bookkeeper MUST be the only agent that writes to the knowledge base; all other
  agents are read-only with respect to the knowledge base.
- **FR-006**: The Bookkeeper MUST attach provenance metadata (source agent, mission ID, confidence
  score, freshness timestamp) to every knowledge entry it creates or updates.
- **FR-007**: The Bookkeeper MUST detect and deduplicate knowledge entries for the same entity,
  updating the existing record rather than creating a duplicate.
- **FR-008**: The Bookkeeper MUST flag conflicting information rather than silently discarding one
  source's contribution.
- **FR-009**: The Reporter MUST format structured agent outputs into human-readable summaries
  without adding any new analysis, interpretation, or recommendations.
- **FR-010**: All four agents MUST record their runs via the agent infrastructure and be testable
  offline with mocked inputs and mocked LLM calls.

### Key Entities

- **Assessment**: The Analyst's typed output. Contains significance explanation, thesis impact
  rating, risk summary, and confidence level.
- **PatternReport**: The Pattern Specialist's typed output. Contains identified pattern (or
  absence), supporting technical observations, and confidence level.
- **KnowledgeEntry**: Written by the Bookkeeper to the shared knowledge base. Contains curated
  content, provenance metadata, confidence, freshness, and conflict markers.
- **FormattedSummary**: The Reporter's output. A human-readable text summary ready for Telegram
  delivery or dashboard display.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Analyst produces a complete, typed Assessment for any Research Packet in under
  60 seconds.
- **SC-002**: The Pattern Specialist produces a Pattern Report for any price history input in
  under 30 seconds.
- **SC-003**: The Bookkeeper writes or updates a knowledge entry in under 5 seconds, verified
  in integration tests.
- **SC-004**: Zero duplicate knowledge entries exist after the Bookkeeper processes the same
  entity twice, verified by test cases.
- **SC-005**: 100% of Pattern Specialist outputs contain no investment advice, verified by
  automated schema validation in tests.
- **SC-006**: All reasoning agent tests pass offline in under 90 seconds.

## Assumptions

- All four agents are invoked by the Manager (Feature 008); they are never triggered directly
  by the operator.
- The Analyst and Pattern Specialist operate on the Research Packet assembled by the Researcher
  (Feature 006); they do not call MCP tools directly.
- The Bookkeeper's write operations use the data access layer from Feature 002; it does not call
  MCP tools for knowledge base writes.
- The Reporter's output is consumed by the Telegram Bot (Feature 009) and the Dashboard (Feature
  010); formatting choices are guided by those delivery surfaces.
- Agent model assignments and prompt files are managed through the agent infrastructure from
  Feature 005.
