# Security Requirements Checklist: API & Auth

**Purpose**: Validate security-related requirement quality for auth, admin access control, token/session handling, and degraded dependency behavior.
**Created**: 2026-03-30
**Feature**: [spec.md](../spec.md)

**Note**: This checklist validates requirement quality (not implementation behavior).

## Requirement Completeness

- [X] CHK001 Are authentication requirements specified for every protected route family and not only for examples? [Completeness, Spec §FR-001, Spec §FR-006, Spec §FR-007]
- [X] CHK002 Are explicit requirements defined for refresh token storage, rotation, revocation, and replay prevention? [Completeness, Spec §FR-003, Spec §FR-004]
- [X] CHK003 Are requirements explicit about password handling at creation and verification boundaries (hashing only, no plaintext persistence)? [Completeness, Spec §FR-009]
- [X] CHK004 Are conflict and error requirements defined for identity collisions (`email`, `telegramHandle`) with deterministic responses? [Completeness, Spec §Edge Cases, Spec §FR-017]

## Requirement Clarity

- [X] CHK005 Is "secure httpOnly cookie" fully specified with environment-dependent `Secure`, `SameSite`, path, and expiry semantics? [Clarity, Spec §FR-002, Spec §FR-003]
- [X] CHK006 Is "deterministic structured response bodies" defined by required fields and error taxonomy? [Clarity, Spec §FR-017]
- [X] CHK007 Is "admin-only" consistently defined in terms of exact role matching and forbidden behavior? [Clarity, Spec §FR-007, Spec §FR-018]

## Requirement Consistency

- [X] CHK008 Are Redis failure semantics consistent across auth, rate limiting, and status paths (fail-closed vs fail-open)? [Consistency, Spec §FR-019, Spec §Edge Cases]
- [X] CHK009 Do role and authorization requirements remain consistent between user stories and functional requirements? [Consistency, Spec §User Story 3, Spec §User Story 5, Spec §FR-007]
- [X] CHK010 Are route namespace requirements (`/auth/*`, `/admin/*`, `/api/*`) security-consistent without accidental bypass paths? [Consistency, Spec §Overview, Spec §FR-001, Spec §FR-011, Spec §FR-013, Spec §FR-016]

## Acceptance Criteria Quality

- [X] CHK011 Are security outcomes measurable with objective pass/fail criteria (401/403/503 semantics per scenario)? [Measurability, Spec §SC-002, Spec §SC-003, Spec §SC-008]
- [X] CHK012 Is there traceability from each security-critical requirement to at least one acceptance scenario/success criterion? [Traceability, Spec §FR-001..FR-019, Spec §SC-001..SC-008]

## Scenario Coverage

- [X] CHK013 Are requirements defined for token misuse scenarios (expired, malformed, revoked, rotated, missing)? [Coverage, Spec §User Story 1, Spec §FR-003, Spec §FR-004]
- [X] CHK014 Are authorization requirements defined for all non-admin attempts on admin and trigger endpoints? [Coverage, Spec §User Story 3, Spec §User Story 5, Spec §FR-007, Spec §FR-016]
- [X] CHK015 Are recovery requirements defined for security state after temporary Redis outage restoration? [Gap, Recovery, Spec §FR-019]

## Edge Case Coverage

- [X] CHK016 Are requirements explicit for concurrent refresh attempts using the same session/cookie? [Edge Case, Gap, Spec §FR-003]
- [X] CHK017 Are requirements explicit for deactivated users with still-valid access tokens? [Edge Case, Gap, Spec §FR-006, Spec §FR-012]
- [X] CHK018 Are requirements explicit for missing/invalid cookie attributes across local vs production deployment? [Edge Case, Spec §FR-002, Spec §FR-003]

## Non-Functional Security Requirements

- [X] CHK019 Are requirements explicit about logging boundaries to avoid leaking sensitive fields/tokens while preserving auditability? [Non-Functional, Spec §FR-005, Spec §FR-017]
- [X] CHK020 Are no-hardcoded-secret/no-hardcoded-security-window expectations explicitly captured as requirement constraints? [Non-Functional, Spec §FR-010, Gap]

## Dependencies & Assumptions

- [X] CHK021 Are assumptions about admin-managed provisioning and role model documented as enforceable security constraints (not just narrative)? [Assumption, Spec §FR-018, Spec §Assumptions]
- [X] CHK022 Are dependency expectations on data-layer token/session persistence defined with failure behavior? [Dependency, Spec §Assumptions, Spec §FR-003, Spec §FR-004]

## Ambiguities & Conflicts

- [X] CHK023 Are terms like "active session" and "valid active session" unambiguous and schema-aligned? [Ambiguity, Spec §FR-003]
- [X] CHK024 Are there any conflicts between availability goals and fail-closed requirements for auth/session paths? [Conflict, Spec §FR-015, Spec §FR-019]

