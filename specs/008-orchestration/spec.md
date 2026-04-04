# Feature Specification: Orchestration

**Feature Branch**: `008-orchestration`
**Created**: 2026-04-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Manager Routes an Operator Query to the Right Specialists (Priority: P1)

An operator sends a text question: "Why is Gold moving today?". The Manager receives this input,
classifies the intent, determines which agents need to be involved (Researcher, Analyst, Reporter),
and dispatches the mission in the correct sequence. The operator receives a formatted answer when
the mission completes — without needing to know which agents ran or in what order.

**Why this priority**: The Manager is the entry point for all operator-initiated intelligence
requests. Without orchestration, the agent team has no coordinator.

**Independent Test**: Submit a natural-language query, verify a Mission is created, verify the
correct agents are invoked in the expected order, verify a formatted response is produced, and
verify the mission is marked complete.

**Acceptance Scenarios**:

1. **Given** an operator query about a specific asset, **When** submitted to the Manager, **Then**
   a Mission is created, the Researcher and Analyst are invoked in sequence, and a formatted
   response is returned to the operator.
2. **Given** a mission that requires pattern analysis, **When** the Manager orchestrates it,
   **Then** the Technician (Pattern Specialist) is included in the agent sequence.
3. **Given** a completed mission, **When** the Manager has a formatted response, **Then** the
   mission status is updated to complete and the response is available for delivery.

---

### User Story 2 — Alert-Triggered Mission Runs Automatically Without Operator Input (Priority: P1)

The Watchdog raises an alert for a price threshold breach. The orchestration system detects the
new alert, opens a mission automatically, routes it through the investigation pipeline, and
delivers the result to the operator's Telegram channel. No operator action is needed to start
the investigation.

**Why this priority**: Automated alert-to-investigation flow is the primary value of the always-on
system. Without it, the operator must manually trigger every investigation.

**Independent Test**: Create an alert programmatically, verify the orchestration system opens a
mission automatically, verify the investigation pipeline runs to completion, and verify the result
is queued for delivery.

**Acceptance Scenarios**:

1. **Given** an alert is created by the Watchdog, **When** the orchestration system processes
   it, **Then** a mission is opened and the investigation pipeline is triggered without operator
   action.
2. **Given** multiple concurrent alerts, **When** the orchestration system processes them, **Then**
   each alert results in its own mission running independently without blocking others.
3. **Given** an alert-triggered mission that fails during the investigation, **When** the failure
   is recorded, **Then** the operator is notified of the failure rather than silently dropped.

---

### User Story 3 — Scheduled Daily Brief Is Produced Every Morning (Priority: P2)

At a configured time each morning, the orchestration system automatically runs a daily briefing
pipeline. It assembles a summary of watchlist status, recent alerts, and any significant changes
since the previous day, and delivers the brief to the operator.

**Why this priority**: The daily brief is a key operator-facing output that requires no manual
trigger. It provides continuous situational awareness even on quiet market days.

**Independent Test**: Trigger the daily brief pipeline manually, verify it runs to completion,
verify the output contains watchlist status and recent alert summaries, and verify it is queued
for delivery.

**Acceptance Scenarios**:

1. **Given** the daily brief schedule is configured, **When** the trigger fires, **Then** the
   brief pipeline runs and produces a formatted summary of watchlist status and recent alerts.
2. **Given** no alerts in the past 24 hours, **When** the daily brief runs, **Then** it still
   produces a brief noting the quiet period rather than an empty output.

---

### User Story 4 — Manager Preserves and Continues Mission State Across Restarts (Priority: P2)

The server restarts while a mission is in progress. When the orchestration system comes back up,
it detects the incomplete mission, restores its state, and resumes from the last checkpoint rather
than starting over or losing the mission entirely.

**Why this priority**: An always-on system must survive restarts. Without state persistence,
any interruption loses work in progress and may cause duplicate results.

**Independent Test**: Start a mission, interrupt the process mid-run, restart it, verify the
mission resumes from its last checkpoint, and verify no steps are duplicated.

**Acceptance Scenarios**:

1. **Given** a mission that was interrupted mid-run, **When** the system restarts, **Then** the
   mission is detected and resumed from its last recorded checkpoint.
2. **Given** a mission that completed before the restart, **When** the system restarts, **Then**
   the completed mission is not re-run.

---

### Edge Cases

- What happens when an agent in the pipeline fails and cannot be retried?
- How does the Manager handle a query it cannot classify (ambiguous intent)?
- What if the Celery worker queue is full or the worker is unavailable?
- How are circular routing attempts (if the Manager mistakenly routes back to itself) prevented?
- What if two operators send conflicting instructions about the same asset simultaneously?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Manager MUST classify incoming inputs (operator queries, alerts, schedules) and
  route them to the appropriate agents without performing content analysis itself.
- **FR-002**: The orchestration system MUST execute agent pipelines as stateful, checkpointed
  workflows so that state is recoverable after a restart.
- **FR-003**: The orchestration system MUST support concurrent execution of multiple missions
  without one blocking another.
- **FR-004**: Alert-triggered missions MUST start automatically when an alert is created, without
  requiring operator input.
- **FR-005**: Scheduled pipelines (daily brief, watchdog scan) MUST be configurable via YAML with
  cron-style scheduling, not hardcoded run times.
- **FR-006**: A failed agent step MUST be retried according to configured retry policy before the
  mission is marked failed.
- **FR-007**: The operator MUST be notified when a mission fails, with a description of the
  failure sufficient to understand what went wrong.
- **FR-008**: The Mission lifecycle (pending → running → completed/failed) MUST be recorded in the
  database at each transition.
- **FR-009**: All orchestration flows MUST be testable offline using mocked agent responses and
  a test task queue.

### Key Entities

- **Mission**: The unit of orchestrated work (covered in Feature 002). The Manager creates and
  progresses missions through their lifecycle.
- **Pipeline**: A defined sequence of agent invocations for a given mission type (e.g.,
  investigation pipeline, daily brief pipeline). Configured, not hardcoded.
- **Schedule**: A configured trigger (time-based or event-based) that initiates a pipeline. Stored
  in YAML and managed by the background scheduler.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator query produces a formatted response and a completed mission within
  3 minutes for a standard single-asset investigation.
- **SC-002**: An alert-triggered mission starts within 60 seconds of the alert being created.
- **SC-003**: The daily brief is delivered within 5 minutes of the scheduled trigger time.
- **SC-004**: A mission interrupted by a system restart resumes from its checkpoint within 30
  seconds of the system coming back online.
- **SC-005**: All orchestration tests pass offline in under 90 seconds.
- **SC-006**: Zero mission state is lost when the system restarts cleanly, verified by tests.

## Assumptions

- The background task system (Celery + Redis) is the execution engine for agent pipelines;
  the Manager defines the routing logic but does not execute tasks directly.
- Pipeline definitions (which agents run for which mission type) are configurable in YAML; adding
  a new pipeline type does not require code changes to the Manager.
- The Manager uses the LangGraph supervisor graph pattern; each pipeline is a graph with nodes
  for each agent and edges defined by routing logic.
- Checkpointing frequency is per-agent-step; the state after each agent completes is persisted
  before the next agent is called.
- The Telegram Bot (Feature 009) is responsible for delivering completed mission outputs to the
  operator; the orchestration system queues results for delivery.

