# Research: Collector Agents (006)

## Decision 1: Explicit agent-module scope is mandatory in design artifacts

- **Decision**: Plan and contracts explicitly scope Watchdog, Screener, Researcher, and Technician as separate collector modules.
- **Rationale**: Prevents scope ambiguity and protects implementation from collapsing into generic "collector" code that weakens boundaries.
- **Alternatives considered**:
  - Generic collector pipeline with role flags: rejected due to weaker ownership and harder boundary enforcement.
  - Deferring scope naming to tasks only: rejected because plan/contracts would stay ambiguous.

## Decision 2: Collector boundary enforcement via output-contract constraints

- **Decision**: Each collector output contract explicitly limits payloads to collected facts, computed signals, and metadata (no thesis/recommendation content).
- **Rationale**: Constitution requires strict role boundaries; enforcement must be testable at collector-output boundaries.
- **Alternatives considered**:
  - Prompt-only boundary control: rejected as insufficient without output contract assertions.
  - Review-time manual checks only: rejected due to high drift risk.

## Decision 3: Monitoring and discovery persist independently from mission collection

- **Decision**: Watchdog/Screener persist periodic outputs independently; Researcher/Technician produce mission-scoped collection outputs with validation before handoff.
- **Rationale**: Separates proactive and mission-triggered flows while preserving shared collector standards.
- **Alternatives considered**:
  - Unified persistence stream for all collectors: rejected due to mixed lifecycle semantics.
  - Mission-only persistence: rejected because proactive runs require durable history and auditability.

## Decision 4: Recoverable-failure semantics for malformed collector outputs

- **Decision**: Malformed collector outputs fail in a recoverable way compatible with queue retry semantics and without emitting invalid downstream payloads.
- **Rationale**: Preserves system stability while avoiding silent corruption of investigation pipelines.
- **Alternatives considered**:
  - Best-effort partial malformed output forwarding: rejected due to downstream unpredictability.
  - Immediate hard-stop without retry path: rejected due to avoidable operational fragility.

## Decision 5: Scheduler registration must be duplicate-free under restart conditions

- **Decision**: Scheduler initialization is designed/tested for duplicate-free registration across restart/re-initialization events.
- **Rationale**: Repeated startup is normal in deployment operations; duplicate periodic jobs create false signals and cost drift.
- **Alternatives considered**:
  - One-time boot-time registration assumption: rejected as unsafe under real restarts.
  - Manual operator cleanup on duplicates: rejected due to operational burden.

## Decision 6: Offline-first test strategy for all collector workflows

- **Decision**: Watchdog/Screener/Researcher/Technician and scheduler behavior are validated using deterministic mocks with no external network calls.
- **Rationale**: Constitution and repository quality gates require reproducible offline testing.
- **Alternatives considered**:
  - Shared dev services for tests: rejected due to non-determinism and setup burden.
  - Partial offline coverage only: rejected as insufficient for regression confidence.

## Decision 7: Configuration-driven thresholds, schedules, and run controls

- **Decision**: All behavior-critical values (thresholds, cadence, retries, limits) remain sourced from runtime configuration.
- **Rationale**: Satisfies Everything-as-Code principle and avoids source-level drift/magic values.
- **Alternatives considered**:
  - Hardcoded safe defaults in collector modules: rejected due to governance violation.
  - Mixed hardcoded/config approach: rejected for auditability and maintainability risk.