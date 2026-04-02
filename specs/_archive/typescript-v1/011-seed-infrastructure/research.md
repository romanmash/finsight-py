# Research: Seed & Infrastructure Readiness (011)

## Decision 1: Seed Reconciliation Strategy

- **Decision**: Implement seed using deterministic upsert/reconcile semantics keyed by stable business identifiers (email, ticker/listType, mission metadata anchors) rather than destructive reset.
- **Rationale**: Supports rerun safety, preserves developer/local state, and fulfills idempotency requirement from spec/decisions.
- **Alternatives considered**:
  - Truncate + reinsert every run: rejected because destructive and unsafe for shared/dev environments.
  - Best-effort insert-ignore only: rejected because does not update stale baseline records deterministically.

## Decision 2: Seed Credential and Secret Handling

- **Decision**: Seeded credential-sensitive values come from environment/config inputs; source code contains no hardcoded secrets.
- **Rationale**: Aligns with constitution and project-level hardcoded-secret policy; prevents accidental secret leakage.
- **Alternatives considered**:
  - Hardcoded demo passwords/tokens in seed source: rejected due policy violation and security risk.
  - Interactive prompt at seed runtime: rejected because unsuitable for CI/non-interactive workflows.

## Decision 3: Seed Data Scope for Demo Readiness

- **Decision**: Seed baseline must include all demo-critical domains: personas, holdings/watchlists, KB thesis + history with contradiction event, screener run(s), alert(s), mission history with agent-run traces, and ingestion baseline.
- **Rationale**: Ensures immediate demo viability across API, Telegram, and dashboard experiences.
- **Alternatives considered**:
  - Minimal seed (users only): rejected because major product flows remain empty.
  - Synthetic random seed on each run: rejected because non-deterministic demos and flaky verification.

## Decision 4: CI Pipeline Shape

- **Decision**: Use staged workflow with ordered validation gates (`typecheck -> lint -> test -> build`) and branch-gated deployment stage.
- **Rationale**: Predictable gate behavior, easy failure isolation, and explicit separation of validate-only vs deploy-capable triggers.
- **Alternatives considered**:
  - Single monolithic job: rejected due poor diagnosability and weaker control over deploy gating.
  - Deploy on every branch: rejected due safety/risk and branch-policy mismatch.

## Decision 5: Deployment Script Reliability Pattern

- **Decision**: Deployment script performs explicit preflight checks, artifact sync, remote compose update/restart, and post-deploy health verification with non-zero failure exits.
- **Rationale**: Matches operator expectations and reduces hidden partial-deploy failures.
- **Alternatives considered**:
  - Blind restart without health checks: rejected because failures surface too late.
  - Manual SSH runbook only: rejected because inconsistent and error-prone.

## Decision 6: Logs Helper Behavior

- **Decision**: Logs helper accepts named service/container target and streams logs remotely with clear usage/validation errors.
- **Rationale**: Fast operator diagnostics and repeatable troubleshooting ergonomics.
- **Alternatives considered**:
  - Tail all logs only: rejected due noise and poor focus.
  - No helper script: rejected due higher operational friction.

## Decision 7: Infrastructure-as-Code Scope

- **Decision**: Add Pulumi stack definition focused on reproducible preview/provision intent for core runtime components; keep final implementation modular and environment-parameterized.
- **Rationale**: Provides credible deployability evidence while allowing iterative expansion.
- **Alternatives considered**:
  - Defer IaC entirely: rejected because feature scope explicitly includes infrastructure readiness.
  - Overly broad IaC in one pass: rejected due high risk and weak incremental verification.

## Decision 8: Environment Variable Contract Management

- **Decision**: Treat `.env.example` as authoritative human-facing contract and ensure all required runtime/deploy variables are represented with clear semantics.
- **Rationale**: Prevents setup ambiguity and startup-time missing-variable failures.
- **Alternatives considered**:
  - Document vars only in scattered docs: rejected due drift risk.
  - Rely on runtime errors for discovery: rejected due poor onboarding experience.

## Outcome

All technical-context unknowns are resolved with implementation-ready decisions, and preserved manual details are mapped into explicit planning constraints for `/speckit-tasks`.
