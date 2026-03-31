# Compatibility Checklist: 006 -> 007/008

**Purpose**: Ensure collector outputs from 006 are stable and non-conflicting for reasoning (007) and orchestration (008).
**Created**: 2026-03-31
**Feature**: [spec.md](../spec.md)

## Contract Stability

- [X] CCHK001 Are collector output contracts documented in one canonical place for 007/008 consumers? (`contracts/collector-agents-contracts.md`)
- [X] CCHK002 Are Watchdog alert context minimum fields explicitly defined?
- [X] CCHK003 Is Screener trigger provenance constrained to `scheduled|manual` with validation behavior defined?
- [X] CCHK004 Is Screener evidence field name fixed as `supportingHeadline`?
- [X] CCHK005 Is Technician `confidence` type fixed as numeric `[0,1]`?

## Boundary Integrity

- [X] CCHK006 Does 006 preserve collection/computation boundaries and avoid thesis/recommendation generation?
- [X] CCHK007 Are 007 reasoning responsibilities preserved for synthesis and user-facing conclusions?
- [X] CCHK008 Are 008 orchestration responsibilities preserved for routing/retry/pipeline control?

## Runtime Semantics

- [X] CCHK009 Are collector operational states (`active|idle|error`) and Redis key conventions explicitly documented?
- [X] CCHK010 Are repeatable scheduler jobs and retry semantics documented and aligned with runtime config?
- [X] CCHK011 Is duplicate-safe scheduler registration behavior specified?

## Data Model Consistency

- [X] CCHK012 Are `data-model.md` entity fields consistent with `apps/api/src/types/collectors.ts`?
- [X] CCHK013 Are persistence-vs-runtime naming differences documented (`no_candidates` vs `noCandidates`)?

## Change Governance

- [X] CCHK014 Does 006 spec define cross-feature change governance for contract-breaking changes?
- [X] CCHK015 Have equivalent compatibility notes been added into 007 and 008 specs?

## Notes

- 006 contract baseline is now explicitly deterministic and contract-first.
- 007/008 implementation should treat 006 internals as opaque and consume typed payload contracts only.

