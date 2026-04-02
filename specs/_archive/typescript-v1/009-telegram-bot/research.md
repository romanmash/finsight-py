# Research: Telegram Bot (009)

## Decision 1: Preserve polling operation mode

- **Decision**: Keep bot operation in long-polling mode for this feature.
- **Rationale**: Aligns with current deployment simplicity and avoids webhook ingress/TLS operational coupling.
- **Alternatives considered**:
  - Webhook mode: rejected for added infrastructure complexity not required by current scope.

## Decision 2: Use Telegram-handle auth as interaction boundary

- **Decision**: Authenticate incoming Telegram messages by matching sender handle to active user records before command execution.
- **Rationale**: Enforces least-cost rejection path and preserves explicit product security model in existing docs.
- **Alternatives considered**:
  - In-chat self-registration: rejected; out of scope and conflicts with admin-created-account policy.
  - Token-based bot command auth: rejected due to poor UX and redundant identity mapping.

## Decision 3: Persist chat destination on first successful contact

- **Decision**: Persist Telegram chat destination when a known active user first interacts successfully.
- **Rationale**: Required for proactive pushes from non-chat-triggered workflows.
- **Alternatives considered**:
  - Manual chat-id provisioning: rejected due to operational friction and drift risk.

## Decision 4: Keep explicit 16-command contract intact

- **Decision**: Preserve original manual command catalog and argument semantics as a stable UX contract.
- **Rationale**: Avoids regressions and provides deterministic behavior for testers/operators.
- **Alternatives considered**:
  - Command consolidation/reduction: rejected for compatibility risk with expected workflows.

## Decision 5: Non-command text routes as operator query

- **Decision**: Treat free-text Telegram messages as general operator-query requests.
- **Rationale**: Maintains conversational UX and aligns with existing mission routing model.
- **Alternatives considered**:
  - Reject non-command text: rejected due to usability loss.

## Decision 6: Enforce restart-resilient per-user rate limiting

- **Decision**: Keep per-user throttling backed by shared runtime state and configuration.
- **Rationale**: Protects cost and availability while preserving policy consistency across restarts.
- **Alternatives considered**:
  - In-memory process-only throttling: rejected due to reset-on-restart loophole.

## Decision 7: Mission-labeled formatting with safe chunking

- **Decision**: Apply mission labels and split oversized responses into ordered chunks at readable boundaries.
- **Rationale**: Preserves readability and platform message constraints without truncation.
- **Alternatives considered**:
  - Hard truncation: rejected due to information loss.
  - Unlabeled raw payload output: rejected due to poor operator UX.

## Decision 8: Proactive push as first-class delivery path

- **Decision**: Support direct push delivery for alerts and scheduled briefs via stored user chat destination.
- **Rationale**: Core product value includes proactive intelligence delivery.
- **Alternatives considered**:
  - Poll-only user retrieval: rejected; reduces product differentiation and timeliness.

## Decision 9: Missing chat destination is safe-skip + warning log

- **Decision**: If a user has no stored chat destination, skip push and emit warning logs.
- **Rationale**: Avoids hard failures while preserving observability and diagnosis path.
- **Alternatives considered**:
  - Throw hard error and fail upstream flow: rejected due to avoidable disruption.

## Decision 10: Compatibility with 008 orchestration is contract-only

- **Decision**: Bot invokes existing API/orchestration interfaces and does not duplicate routing logic.
- **Rationale**: Preserves separation of concerns and prevents divergence from manager behavior.
- **Alternatives considered**:
  - Bot-side mission routing: rejected due to duplication and drift risk.