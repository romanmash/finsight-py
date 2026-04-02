# Feature Specification: Agent Infrastructure

**Feature Branch**: `005-agent-infrastructure`
**Created**: 2026-04-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — An Agent Executes a Task and Its Run Is Recorded with Full Observability (Priority: P1)

A developer triggers an agent to perform a task. The agent runs, calls tools via the MCP client,
produces a typed output, and completes. Every LLM call made during the run is recorded: which
model was used, how many tokens were consumed, the cost in USD, and how long it took. The entire
run is traceable in the observability platform from input to output.

**Why this priority**: Observability and cost tracking are mandatory from the first agent. Without
this infrastructure, all nine subsequent agent features are untrackable and undebuggable.

**Independent Test**: Run a simple agent task, verify an AgentRun record is created in the
database with correct token counts and cost, and verify the run appears in the LLM trace viewer.

**Acceptance Scenarios**:

1. **Given** an agent is triggered with an input, **When** the agent completes its task, **Then**
   an AgentRun record is stored with tokens consumed, cost in USD, model used, provider, and
   duration.
2. **Given** an agent makes multiple LLM calls during a task, **When** the run completes, **Then**
   each call is individually recorded and the AgentRun totals reflect the sum of all calls.
3. **Given** an agent run, **When** viewed in the trace viewer, **Then** the full call sequence
   is visible as a linked trace from input through all intermediate steps to output.

---

### User Story 2 — An Agent Calls a Tool via the MCP Client and Receives a Typed Response (Priority: P1)

An agent needs data from one of the three tool servers. It calls the tool by name through the
shared MCP client. The client routes the call to the correct server, handles errors, and returns
the response as a typed object the agent can use directly. The agent does not manage server
addresses, serialisation, or retries.

**Why this priority**: All collector and reasoning agents depend on tool access via the MCP
client. Without this abstraction, every agent would duplicate connection and error-handling logic.

**Independent Test**: Call a tool through the MCP client with valid parameters, receive a typed
response, call with invalid parameters, and verify a structured error is returned.

**Acceptance Scenarios**:

1. **Given** the MCP client configured with server addresses, **When** a tool call is made by
   name, **Then** the response is returned as a typed object matching the tool's output schema.
2. **Given** a tool call with invalid parameters, **When** routed through the MCP client, **Then**
   a structured validation error is returned without an unhandled exception.
3. **Given** a tool server is unreachable, **When** a tool call is attempted, **Then** the MCP
   client returns a connection error after the configured timeout rather than blocking indefinitely.

---

### User Story 3 — Agent Output Is Validated Against a Typed Schema Before Being Used (Priority: P1)

An agent produces output in a structured format. Before that output is accepted and passed to
the next step in the workflow, it is validated against the agent's declared output schema. If the
output is malformed, the run is retried once. If the second attempt also fails, the mission is
marked as failed with a descriptive error — the malformed output is never silently accepted.

**Why this priority**: Type-safe agent outputs prevent downstream corruption. This guarantee must
be built into the infrastructure so all agents benefit automatically.

**Independent Test**: Configure an agent to produce an intentionally malformed output, verify the
retry is triggered, configure both attempts to fail, and verify the mission is marked failed with
a clear error message.

**Acceptance Scenarios**:

1. **Given** an agent returns a valid, schema-conforming output, **When** validation runs, **Then**
   the output is accepted and the run is marked successful.
2. **Given** an agent returns a malformed output on the first attempt, **When** validation fails,
   **Then** the run is retried once automatically.
3. **Given** both the initial attempt and the retry produce malformed output, **When** validation
   fails twice, **Then** the mission is marked failed and the error is recorded — no further retry
   is attempted.

---

### User Story 4 — Agent Prompts Are Colocated and Versioned with Agent Code (Priority: P2)

A developer updates the prompt for an agent. The prompt lives in a dedicated file alongside the
agent's code, not embedded in application configuration or a database. The change is tracked in
version control. Shared prompt fragments (system preambles, formatting instructions) are stored
once and referenced by multiple agents.

**Why this priority**: Prompt co-location keeps agent reasoning and its instructions together and
version-controlled. This is a structural discipline that all agents must follow from the start.

**Independent Test**: Locate the prompt file for any agent, verify it lives in the same directory
as the agent code, modify the prompt, and verify the change is picked up on the next agent run.

**Acceptance Scenarios**:

1. **Given** any agent in the system, **When** its directory is inspected, **Then** a dedicated
   prompt file is present in the same location as the agent's logic file.
2. **Given** shared prompt content (e.g., a system role description), **When** multiple agents
   use it, **Then** the shared content is stored once and referenced — not duplicated across
   agent-specific files.

---

### Edge Cases

- What happens when the LLM provider is unreachable during an agent run?
- How are agent runs that time out handled — are partial records stored?
- What if the configured model name is not present in the pricing registry?
- How does the system handle an agent that recurses or calls itself unexpectedly?
- What if two concurrent agent runs attempt to update the same mission simultaneously?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a base agent abstraction that all 7 agents extend, handling
  LLM call execution, output validation, cost recording, and error handling consistently.
- **FR-002**: Every LLM call MUST be recorded with provider, model, tokens consumed (input and
  output), cost in USD, and duration in milliseconds, linked to the triggering AgentRun record.
- **FR-003**: Cost MUST be computed deterministically from a configurable pricing registry; an
  unknown model MUST record cost as zero with a warning rather than blocking execution.
- **FR-004**: The system MUST provide a shared MCP client used by all agents to call tools by
  name, abstracting server routing, serialisation, timeout handling, and error wrapping.
- **FR-005**: Agent outputs MUST be validated against a declared typed schema; a malformed output
  MUST trigger one automatic retry before the run is marked failed.
- **FR-006**: All agent runs MUST produce LLM traces in the configured observability platform,
  with each call in the run linked as a child span of the overall run trace.
- **FR-007**: Agent prompts MUST be colocated with agent code in the same directory; shared prompt
  fragments MUST be stored once in a shared location and referenced by agents that need them.
- **FR-008**: If the primary LLM provider is unavailable, the system MUST fall back to the
  configured secondary provider per agent configuration without requiring a code change.
- **FR-009**: All agent infrastructure behaviour MUST be testable offline without a running LLM
  provider, using recorded response fixtures or mocked LLM calls.

### Key Entities

- **Agent**: A named specialist with a declared input type, output type, system prompt, and
  model configuration. Extends the base agent abstraction.
- **AgentRun**: A record of a single agent execution (covered in detail by Feature 002 Data Layer).
  Created by the base abstraction automatically.
- **MCPClient**: The shared tool-calling client. Knows all server addresses, routes calls by tool
  name, and wraps responses in typed objects.
- **PromptFile**: A versioned text file colocated with an agent, containing the agent's system
  prompt and any agent-specific instructions.
- **PricingRegistry**: A configurable map from model names to per-token costs. Used to compute
  cost for every LLM call deterministically.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every agent run produces a complete AgentRun record with all required fields
  populated, verified in 100% of test cases.
- **SC-002**: LLM cost for any agent run matches the deterministic calculation from the pricing
  registry to within floating-point precision, verified by unit tests.
- **SC-003**: A tool call through the MCP client completes and returns a typed response within
  the configured timeout (default 30 seconds).
- **SC-004**: Agent output validation catches 100% of schema violations in test cases and
  triggers the retry mechanism correctly.
- **SC-005**: All agent infrastructure tests pass offline in under 60 seconds without a running
  LLM provider or tool server.
- **SC-006**: Switching a model or provider for any agent requires only a configuration change,
  verified by a test that runs the agent with two different model configurations.

## Assumptions

- All 7 agents share the same base abstraction; no agent bypasses the infrastructure for LLM
  calls, tool calls, or output handling.
- The MCP client configuration (server addresses, timeouts) is loaded from YAML at startup.
- LLM provider credentials are loaded from `.env`; no credentials appear in agent code or YAML.
- Offline tests use pre-recorded LLM response fixtures; the fixture format is decided during
  planning.
- The observability platform (LangSmith) is optional in test environments; when unavailable,
  traces are logged locally rather than blocking execution.
- The pricing registry is loaded from `config/runtime/pricing.yaml`; adding a new model requires
  only adding a row to that file.
