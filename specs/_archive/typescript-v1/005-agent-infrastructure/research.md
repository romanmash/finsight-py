# Research: Agent Infrastructure (005)

## Decision 1: MCP tool registry initializes from server manifests at startup

- **Decision**: Build a startup initialization routine that fetches tool manifests from configured MCP servers and constructs per-server plus merged registries for agent runtime.
- **Rationale**: Ensures one authoritative runtime source of available tools and catches missing dependencies before mission execution.
- **Alternatives considered**:
  - Lazy-on-first-use manifest fetch: rejected due to runtime unpredictability and delayed failures.
  - Static hardcoded tool maps: rejected due to drift risk and violation of configuration-driven boundaries.

## Decision 2: Required MCP reachability is fail-fast during readiness

- **Decision**: Treat required MCP server unreachability as startup-readiness failure with explicit server naming.
- **Rationale**: Avoids partial runtime states where some agents silently fail during live missions.
- **Alternatives considered**:
  - Degraded boot with partial tool availability: rejected for P1 agent reliability and deterministic behavior.

## Decision 3: Duplicate tool names in merged registry are rejected

- **Decision**: Registry merge enforces unique tool identifiers and fails on collisions.
- **Rationale**: Ambiguous tool routing creates non-deterministic agent behavior and hidden operational bugs.
- **Alternatives considered**:
  - Last-write-wins collision handling: rejected because behavior depends on merge order.

## Decision 4: Provider resolution uses deterministic primary/fallback policy

- **Decision**: Resolve model provider by agent policy; if primary unavailable, select fallback when configured; otherwise return explicit error.
- **Rationale**: Predictable routing is required for mission reproducibility and observability.
- **Alternatives considered**:
  - Opportunistic provider auto-selection: rejected due to opaque behavior and harder incident debugging.

## Decision 5: Mission-mode overrides are bounded and validated

- **Decision**: Support explicit runtime override inputs (e.g., temperature) only within policy-defined bounds.
- **Rationale**: Enables controlled behavior shifts (e.g., devil-advocate mode) without creating unsafe/unbounded generation behavior.
- **Alternatives considered**:
  - Unbounded override pass-through: rejected due to policy drift and reliability risk.

## Decision 6: Local-provider health state is actively probed and cached for routing

- **Decision**: Probe local provider availability on startup and at periodic intervals using bounded timeout; route decisions consume latest known state.
- **Rationale**: Prevents hard stalls when local provider is down and enables automatic fallback.
- **Alternatives considered**:
  - Probe on every request: rejected due to avoidable latency and noise.
  - Static startup-only probe: rejected because health can change during runtime.

## Decision 7: Offline test strategy uses deterministic MCP/provider mocks

- **Decision**: Validate tool initialization, invocation, fallback, and probe behavior entirely with offline mocks in tests.
- **Rationale**: Satisfies constitution requirement that tests pass without external network dependencies.
- **Alternatives considered**:
  - Integration tests against live services only: rejected due to instability and CI/environment coupling.