# API Requirements Checklist: API & Auth

**Purpose**: Validate API/auth requirements quality for clarity, completeness, consistency, and measurability before/while implementation.
**Created**: 2026-03-30
**Feature**: [spec.md](../spec.md)

**Note**: This checklist validates requirement quality (not implementation behavior).

## Requirement Completeness

- [X] CHK001 Are explicit requirements defined for refresh-cookie attributes across environments (Secure, HttpOnly, SameSite, path, expiry)? [Completeness, Spec §FR-002, Spec §FR-003]
- [X] CHK002 Are conflict-response requirements for duplicate `email` and duplicate `telegramHandle` both explicitly specified (status code + error shape)? [Completeness, Spec §FR-012, Spec §Edge Cases]
- [X] CHK003 Are requirements for token revocation scope fully defined (single-session logout vs global logout semantics)? [Gap, Spec §FR-004]
- [X] CHK004 Are requirements defined for behavior when a user is deactivated while holding a still-valid access token? [Gap, Spec §FR-006, Spec §FR-012]

## Requirement Clarity

- [X] CHK005 Is "deterministic structured error body" defined with mandatory fields and field-level semantics? [Clarity, Spec §FR-017]
- [X] CHK006 Is "safe for 3-second polling cadence" translated into explicit server-side expectations (cache TTL bounds, max query fan-out, allowed staleness)? [Clarity, Spec §FR-015]
- [X] CHK007 Is "short TTL" for spend aggregation quantified with numeric bounds to remove interpretation variance? [Ambiguity, Spec §User Story 4 Acceptance #5]
- [X] CHK008 Are "degraded sections with explicit health markers" defined with a precise schema contract for each degraded component? [Clarity, Spec §FR-019]

## Requirement Consistency

- [X] CHK009 Are auth/admin route namespaces consistent across all sections (`/auth/*`, `/admin/*`, `/api/admin/status`, trigger routes)? [Consistency, Spec §Overview, Spec §FR-001, Spec §FR-011, Spec §FR-013, Spec §FR-014, Spec §FR-016]
- [X] CHK010 Do Redis-unavailable rules stay consistent between edge cases, functional requirements, and success criteria without contradiction? [Consistency, Spec §Edge Cases, Spec §FR-019, Spec §SC-008]
- [X] CHK011 Are role restrictions consistent for all admin and trigger endpoints (no missing endpoint-level role assumptions)? [Consistency, Spec §FR-007, Spec §FR-016, Spec §User Story 5]

## Acceptance Criteria Quality

- [X] CHK012 Are all success criteria objectively measurable with pass/fail thresholds rather than qualitative statements? [Measurability, Spec §SC-001..SC-008]
- [X] CHK013 Is SC-007 traceable to explicit requirement IDs for offline execution and mocking obligations? [Traceability, Spec §SC-007, Gap]
- [X] CHK014 Is SC-008 measurable under a stated load/profile baseline (what qualifies as "normal local runtime conditions")? [Measurability, Spec §SC-008]

## Scenario Coverage

- [X] CHK015 Are primary, alternate, exception, and recovery requirements all specified for the full auth lifecycle (login/refresh/logout/me)? [Coverage, Spec §User Story 1, Spec §FR-001..FR-004]
- [X] CHK016 Are requirements defined for concurrent refresh attempts using the same refresh token/session (race and replay handling)? [Gap, Coverage, Spec §FR-003, Spec §Edge Cases]
- [X] CHK017 Are requirements defined for partial-status response semantics when multiple dependencies fail simultaneously? [Coverage, Spec §FR-014, Spec §FR-019]

## Edge Case Coverage

- [X] CHK018 Are timeout and cancellation requirements specified for every dependency call contributing to `GET /api/admin/status` (not only aggregate timeout)? [Edge Case, Spec §FR-015, Spec §SC-008]
- [X] CHK019 Are requirements explicit for user lookup or auth behavior when referenced user records are soft-deleted/missing? [Gap, Edge Case, Spec §FR-006, Spec §FR-018]
- [X] CHK020 Are requirements explicit for malformed or missing refresh cookies across all auth endpoints that rely on cookies? [Edge Case, Spec §FR-003, Spec §FR-004]

## Non-Functional Requirements

- [X] CHK021 Are security requirements specific enough to prohibit hardcoded token windows and require runtime-config-driven TTLs? [Security, Spec §FR-010]
- [X] CHK022 Are observability requirements defined for minimum log fields on auth/admin/status errors (including requestId correlation)? [Non-Functional, Spec §FR-005, Spec §FR-017]
- [X] CHK023 Are performance requirements for status endpoint tied to an explicit failure-mode contract (bounded latency + degraded response guarantees)? [Non-Functional, Spec §FR-015, Spec §FR-019, Spec §SC-008]

## Dependencies & Assumptions

- [X] CHK024 Are assumptions about prior features (`001`, `002`) mapped to explicit dependency requirements and failure behavior if those dependencies are absent/misaligned? [Dependency, Spec §Depends on, Spec §Assumptions]
- [X] CHK025 Is the assumption of role set (`admin`, `analyst`, `viewer`) traceable to a canonical shared-types source to prevent drift? [Assumption, Spec §Assumptions]

## Ambiguities & Conflicts

- [X] CHK026 Are terms like "active mission", "recent mission log", and "KB summary" defined with stable field-level semantics? [Ambiguity, Spec §FR-014]
- [X] CHK027 Is there any conflict between "admin-created users only" and future onboarding expectations that should be explicitly marked out-of-scope? [Conflict, Spec §FR-018, Spec §Assumptions]
- [X] CHK028 Are any acceptance scenarios dependent on unstated seed data or preconditions that should be formalized in requirements? [Gap, Spec §User Stories, Spec §Assumptions]

