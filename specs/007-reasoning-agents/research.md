# Research: Reasoning Agents (007)

## Decision 1: Analyst remains mode-explicit and tool-free

- **Decision**: Implement Analyst as three explicit operating modes (`standard`, `devil_advocate`, `comparison`) with output-schema validation and one retry on malformed output, without external tool invocation during synthesis.
- **Rationale**: This preserves role purity (synthesis only), prevents hidden tool coupling, and keeps behavior deterministic enough for validation and debugging.
- **Alternatives considered**:
  - Dynamic mode registry with implicit behavior branching: rejected due to opacity and weaker testability.
  - Tool-assisted synthesis: rejected because it blurs Analyst/Researcher boundaries.

## Decision 2: Bookkeeper persistence is atomic and snapshot-first

- **Decision**: Non-initial thesis updates must snapshot prior thesis before overwrite; entry write + snapshot + contradiction-linked effects occur in one transaction.
- **Rationale**: Prevents partial KB history and preserves auditability under failures.
- **Alternatives considered**:
  - Sequential non-transactional writes: rejected due to partial-state risk.
  - Snapshot-after-write approach: rejected because it can lose the true pre-update state.

## Decision 3: Contradiction alerting is severity-gated

- **Decision**: Contradiction detection runs on updates, but alert creation is restricted to high-severity outcomes only.
- **Rationale**: Reduces false-positive operational noise while preserving critical escalations.
- **Alternatives considered**:
  - Alert on all contradiction severities: rejected due to alert fatigue.
  - No contradiction alerts: rejected because the feature requires proactive thesis-conflict surfacing.

## Decision 4: Embeddings are required for KB durability

- **Decision**: KB thesis persistence requires successful embedding generation; failed embedding generation aborts the write path.
- **Rationale**: Entries without embeddings degrade retrieval utility and undermine downstream RAG behavior.
- **Alternatives considered**:
  - Store text now and backfill embeddings later: rejected due to retrieval inconsistency and recovery complexity.
  - Optional embeddings for fallback: rejected because this conflicts with guaranteed searchable memory quality.

## Decision 5: Reporter delivery uses fallback and bounded chunking

- **Decision**: Reporter formatting uses configured primary formatter with automatic fallback; output delivery splits over platform size limits into ordered chunks.
- **Rationale**: Preserves user-visible reliability and avoids silent truncation/failed sends.
- **Alternatives considered**:
  - Hard-fail on primary formatter outage: rejected because it causes avoidable user-visible loss.
  - No chunking and truncate message: rejected because information loss is unacceptable for mission output.

## Decision 6: Trader is constrained to proposal-only safety

- **Decision**: Trader creates pending-approval tickets only, includes mandatory human-approval warning text, and rejects invalid sell intents for non-held positions.
- **Rationale**: Enforces constitutional non-autonomous trade policy and prevents unsafe intents from progressing.
- **Alternatives considered**:
  - Auto-execute high-confidence trades: rejected by constitution.
  - Defer position validation to approval time only: rejected due to late-failure UX.

## Decision 7: 006 compatibility is contract-based, not implementation-based

- **Decision**: Reasoning layer consumes collector data strictly by published contract fields/types (including numeric confidence semantics and `supportingHeadline` usage).
- **Rationale**: Decouples 007 from 006 internal changes while preserving integration integrity.
- **Alternatives considered**:
  - Direct reliance on current 006 implementation details: rejected due to brittle coupling.
  - Loose field tolerance without explicit contract mapping: rejected due to hidden integration regressions.

## Decision 8: Offline-first tests are mandatory for reasoning workflows

- **Decision**: Reasoning agent tests run with mocked providers/MCP interactions and deterministic fixtures, with no network requirement.
- **Rationale**: Matches constitution and keeps CI reproducible.
- **Alternatives considered**:
  - Shared integration environment for tests: rejected due to nondeterminism and setup burden.
  - Partial mocking only: rejected because critical branches (fallback, retries, contradictions) need full deterministic coverage.
