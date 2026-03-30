# Feature Specification: Agent Infrastructure

**Feature**: `005-agent-infrastructure`
**Created**: 2026-03-31
**Status**: Draft
**Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)
**Depends on**: `003-api-auth`, `004-mcp-platform`

## Overview

Build the shared agent infrastructure layer that enables all agents to consistently access approved MCP tools and approved language-model providers through one centralized runtime policy.

**Why this feature exists:** Agent workflows depend on two platform capabilities: reliable tool availability and reliable model selection. Without this layer, agents cannot run consistently, cannot enforce fallback behavior, and cannot provide deterministic mission outcomes.

---

## User Scenarios & Testing

### User Story 1 — Unified Tool Availability for Agents (Priority: P1)

As the platform, I want all active MCP tool sets registered and available through one unified agent-facing interface so that agent workflows can execute required actions without server-specific wiring.

**Why this priority**: Mission execution is blocked if agents cannot discover and call required tools.

**Independent Test**: Initialize the tool-access layer against all configured MCP servers and verify each server's expected tool set is available and invocable through the shared interface.

**Acceptance Scenarios**:

1. **Given** all configured MCP servers are healthy, **When** tool initialization runs, **Then** each server's tools are available through the shared registry
2. **Given** a required MCP server is unreachable at initialization, **When** startup validation runs, **Then** initialization fails fast with a clear server-specific error
3. **Given** an agent requires cross-domain tools, **When** it requests the unified tool set, **Then** it receives one merged registry containing all approved tools
4. **Given** a runtime tool invocation error, **When** the call completes, **Then** the caller receives a structured error result without unhandled exceptions

---

### User Story 2 — Deterministic Model Routing with Fallback (Priority: P1)

As an agent runtime, I want model-provider selection resolved from runtime policy with deterministic fallback behavior so that mission execution remains reliable under provider outages.

**Why this priority**: Agents cannot produce outputs without model resolution, and non-deterministic fallback behavior creates inconsistent mission quality.

**Independent Test**: Resolve providers for multiple agent profiles under healthy and degraded conditions and verify policy-compliant primary/fallback outcomes.

**Acceptance Scenarios**:

1. **Given** an agent with a configured primary provider, **When** provider resolution runs and the primary is available, **Then** the primary provider is selected with configured generation settings
2. **Given** an agent whose primary provider is unavailable and fallback is configured, **When** provider resolution runs, **Then** the fallback provider is selected deterministically
3. **Given** an unavailable primary with no configured fallback, **When** provider resolution runs, **Then** resolution fails with a clear actionable error
4. **Given** a mission mode override for generation behavior, **When** provider resolution runs, **Then** override values are applied within allowed policy bounds

---

### User Story 3 — Local-Provider Health Awareness (Priority: P2)

As an operator, I want periodic local-provider health checks so that the router can use local inference when available and fall back quickly when unavailable.

**Why this priority**: This improves cost/performance but is not required for baseline cloud-provider functionality.

**Independent Test**: Execute health checks with local provider available and unavailable; verify state transitions and resulting routing decisions.

**Acceptance Scenarios**:

1. **Given** local provider is reachable and has at least one usable model, **When** health probing runs, **Then** local provider state is marked available
2. **Given** local provider is unreachable or returns unusable model metadata, **When** health probing runs, **Then** local provider state is marked unavailable without crashing the runtime
3. **Given** runtime is active, **When** periodic checks execute, **Then** health state is refreshed at configured intervals and routing decisions reflect current state

---

### Edge Cases

- What happens when two MCP servers expose tools with conflicting names? -> Initialization rejects ambiguous registrations and reports collision details
- What happens when a server's tool manifest changes after startup? -> Existing runtime remains stable; changes are picked up only after controlled re-initialization
- What happens when a provider appears healthy but requests time out intermittently? -> Router applies configured timeout/fallback policy and emits structured failure results
- What happens when local provider reports models but none match policy constraints? -> Provider is treated as unavailable for routing decisions
- What happens when override settings exceed allowed bounds? -> Override is rejected or clamped by policy with explicit validation feedback
- What happens when provider health flaps (alternating available/unavailable)? -> Routing remains deterministic per request: evaluate primary once, then fallback once, emit structured logs for each transition
- What happens when local provider recovers during runtime? -> Next scheduled probe updates state to available and subsequent routing can select local provider again per policy

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST initialize agent tool access from all configured MCP servers before agents begin mission execution
- **FR-002**: System MUST validate MCP server reachability and manifest availability during initialization
- **FR-003**: System MUST expose per-server tool sets and a merged all-tools set for agents requiring multi-domain access
- **FR-004**: System MUST fail fast when required MCP servers are unavailable during startup validation
- **FR-005**: System MUST return structured tool invocation failures without unhandled runtime exceptions
- **FR-006**: System MUST detect and reject duplicate/ambiguous tool identifiers across merged registries
- **FR-007**: System MUST resolve agent model provider using runtime configuration as the source of truth
- **FR-008**: System MUST apply deterministic fallback selection when primary provider is unavailable
- **FR-009**: System MUST return explicit resolution errors when no valid provider path exists
- **FR-010**: System MUST support bounded mission-mode overrides for generation parameters
- **FR-011**: System MUST enforce policy validation on override values before application
- **FR-012**: System MUST perform local-provider health probing with bounded timeout and no process crash on failure
- **FR-013**: System MUST probe local-provider health at startup and on a configurable periodic schedule
- **FR-014**: System MUST treat local provider as unavailable when health checks fail or no policy-valid models are available
- **FR-015**: System MUST expose health state to routing logic so routing decisions use current availability
- **FR-016**: System MUST produce structured logs for tool initialization, provider resolution, fallback decisions, and health-probe outcomes
- **FR-017**: System MUST keep behavior-critical values configuration-driven and must not hardcode secrets in source
- **FR-018**: System MUST be testable offline using mocked MCP/provider dependencies
- **FR-019**: System MUST evaluate provider resolution in deterministic order: primary first, then one configured fallback path, then explicit error
- **FR-020**: System MUST enforce bounded override ranges: temperature 0.0-1.0 and maxTokens 1-8192, with policy-specific tighter bounds allowed
- **FR-021**: System MUST include required failure-envelope fields for tool invocation errors: `error.code`, `error.message`, `error.sourceServer`, `error.retryable`, and `durationMs`
- **FR-022**: System MUST treat local-provider health as stale when last probe age exceeds 2x configured probe interval and route as unavailable until refreshed
- **FR-023**: System MUST allow explicitly optional MCP servers to be skipped at startup while continuing with all required servers

### Operational Definitions

- **Required MCP server**: A server with `required: true` in `config/runtime/mcp.yaml`; readiness failure blocks startup.
- **Optional MCP server**: A server with `required: false`; readiness failure is logged and skipped without blocking startup.
- **Deterministic fallback**: Resolution order is fixed: primary policy -> fallback policy (if configured) -> resolution error. No random/provider-scoring branch selection in 005.
- **Bounded overrides**: Runtime overrides may only target approved generation fields and must satisfy global bounds (`temperature` 0.0-1.0, `maxTokens` 1-8192) plus per-agent policy bounds.
- **Structured tool failure envelope**: Failure result must include `error.code`, `error.message`, `error.sourceServer`, `error.retryable`, and `durationMs`.
- **Health freshness**: Health snapshot older than 2x probe interval is stale and treated as unavailable for routing until a new successful probe arrives.

### Key Entities

- **AgentToolRegistry**: Runtime registry containing server-specific tool sets plus one merged set for cross-domain agents
- **ProviderResolutionPolicy**: Configuration-derived rules defining primary/fallback providers and allowable override behavior per agent
- **ResolvedProviderProfile**: Final provider selection for an invocation, including effective generation settings after policy and overrides
- **LocalProviderHealthState**: Current availability state and last probe result used by routing decisions
- **ToolInvocationResultEnvelope**: Deterministic success/error result structure returned to agent runtime

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of configured required MCP servers must be validated before agent runtime becomes ready; optional servers may be skipped with structured warnings
- **SC-002**: When one required MCP server is unavailable at startup, readiness fails with a server-specific error in under 10 seconds
- **SC-003**: Provider resolution returns a valid primary or fallback path for 100% of configured agents in healthy/degraded test scenarios
- **SC-004**: Local-provider health checks complete within configured timeout and update routing state without unhandled errors
- **SC-005**: In offline test mode, all infrastructure tests pass without external network dependencies
- **SC-006**: Tool invocation and provider-resolution failures produce deterministic structured error envelopes in 100% of tested failure cases
- **SC-007**: Deterministic fallback behavior is verified across three degraded scenarios (primary unavailable, fallback unavailable, and no-fallback configured) with 100% policy-consistent outcomes
- **SC-008**: Provider-resolution median overhead (excluding upstream model latency) remains <= 25 ms in test runs
- **SC-009**: CI/offline test execution performs no external DNS/HTTP calls; all MCP/provider interactions are mocked

## Assumptions

- Feature `004-mcp-platform` provides stable MCP contracts for health, manifest, and invocation
- Feature `003-api-auth` provides required authenticated runtime context for agent operations
- Runtime configuration already defines agent provider preferences and fallback options
- Local-provider usage is optional; cloud-provider paths remain the baseline when local provider is unavailable
- Full model-quality evaluation is out of scope for this feature; this feature covers routing/availability behavior only
- Feature `004-mcp-platform` contract semantics are version-stable for this feature cycle (manifest and invoke response shapes are non-breaking)
- Feature `003-api-auth` authentication context contract is version-stable for this feature cycle (no breaking runtime context changes)
