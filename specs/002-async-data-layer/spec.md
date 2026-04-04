# Feature Specification: Data Layer

**Feature Branch**: `002-async-data-layer`
**Created**: 2026-04-02
**Status**: Ready for Implementation

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Agent Persists and Retrieves a Mission Record (Priority: P1)

An agent running inside the system creates a new mission, records its status, and associates
multiple agent run records with it. Later, another component queries the mission by ID and
receives the mission with all related agent runs. No component writes raw data queries — they
use the provided data access layer which handles all persistence details.

**Why this priority**: Mission persistence is the backbone of the entire multi-agent system.
Every agent, every workflow, and every observable behaviour depends on being able to read and
write mission state reliably.

**Independent Test**: Create a mission record via the data access layer, attach agent run records,
retrieve the mission with its runs by ID, and verify all fields and relationships are intact.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** a mission is created with required fields, **Then** the
   mission is stored and retrievable by its unique identifier with all fields preserved.
2. **Given** an existing mission, **When** multiple agent run records are attached to it, **Then**
   all runs are retrievable via the mission and each run correctly references its parent mission.
3. **Given** a mission in an intermediate state, **When** its status is updated, **Then** the
   stored status reflects the new value and the previous value is no longer returned.

---

### User Story 2 — Bookkeeper Stores and Searches Knowledge Entries (Priority: P1)

The Bookkeeper agent writes a new knowledge entry containing a text passage and a corresponding
semantic vector. Later, another agent performs a similarity search using a query vector and
retrieves the most relevant knowledge entries. The search is fast enough for interactive use.

**Why this priority**: The shared knowledge base with semantic search is the core intelligence
accumulation mechanism. Without it, agents cannot build compound understanding over time.

**Independent Test**: Insert several knowledge entries with distinct semantic vectors, execute a
similarity query, and verify results are ranked correctly by semantic closeness.

**Acceptance Scenarios**:

1. **Given** several knowledge entries stored with semantic vectors, **When** a similarity search
   is performed with a query vector, **Then** results are returned ranked by relevance within an
   acceptable response time.
2. **Given** a knowledge entry is written by the Bookkeeper, **When** any other component reads
   the same entry by ID, **Then** all fields including the associated text and metadata are
   returned accurately.
3. **Given** a knowledge entry with metadata tags (source, confidence, freshness), **When** a
   filtered query is executed, **Then** only entries matching the filter are returned.

---

### User Story 3 — Watchdog Writes and Reads Watchlist Items and Alerts (Priority: P2)

The Watchdog agent reads the configured watchlist of assets from the data store, evaluates
conditions, and writes alert records when thresholds are crossed. An operator query can later
retrieve all unacknowledged alerts in chronological order.

**Why this priority**: Watchlist and alert persistence is required before any monitoring features
can be built. This story can be tested independently of agents and orchestration.

**Independent Test**: Write several watchlist items, write alert records linked to them, query for
unacknowledged alerts ordered by time, and verify ordering and completeness.

**Acceptance Scenarios**:

1. **Given** a set of watchlist items in the store, **When** queried, **Then** all items are
   returned with their configured thresholds and metadata intact.
2. **Given** the Watchdog has written three alerts, **When** unacknowledged alerts are queried
   in order, **Then** the three alerts are returned in chronological order.
3. **Given** an alert is acknowledged, **When** unacknowledged alerts are queried, **Then** the
   acknowledged alert no longer appears in the result.

---

### User Story 4 — Schema Migrations Apply Cleanly to a Fresh Database (Priority: P2)

A developer applies all schema migrations to a brand-new database and receives confirmation that
the schema is up to date. Running migrations a second time on the already-migrated database
completes without errors or data loss.

**Why this priority**: Reproducible schema management is required for confident deployment and
for other developers to set up the project. Idempotency prevents accidental data corruption.

**Independent Test**: Apply all migrations to an empty database, verify schema exists, apply
migrations again, and confirm no errors and no schema changes.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** all migrations are applied, **Then** the schema matches
   the expected structure and the migration tool reports success.
2. **Given** a fully migrated database, **When** migrations are applied again, **Then** the
   operation completes without error and the schema is unchanged.
3. **Given** a partially migrated database (some migrations applied, some not), **When** remaining
   migrations are applied, **Then** only the missing changes are applied and existing data is
   unaffected.

---

### User Story 5 — Cache Layer Stores and Expires Temporary Data (Priority: P3)

An MCP server or agent writes a computed result to the shared cache with a time-to-live duration.
A subsequent read within the TTL returns the cached value. After the TTL elapses, the cached value
is no longer returned and is treated as a cache miss.

**Why this priority**: The cache layer underpins all MCP server response caching and Celery
task deduplication. It is needed before those components can be built, but independently testable.

**Independent Test**: Write a value to the cache with a short TTL, read it back immediately
(expect hit), wait for expiry, read again (expect miss).

**Acceptance Scenarios**:

1. **Given** a value written to cache with a TTL of 5 seconds, **When** read within 5 seconds,
   **Then** the stored value is returned.
2. **Given** a value written to cache with a TTL of 1 second, **When** read after 2 seconds,
   **Then** no value is returned (cache miss).
3. **Given** the cache is unavailable, **When** a write or read is attempted, **Then** an
   informative error is raised rather than a silent failure.

---

### Edge Cases

- What happens when a migration is run against a database with an incompatible existing schema?
- How does the system handle a database connection failure mid-transaction?
- What if a similarity search is performed when no knowledge entries exist?
- What if two agents attempt to update the same mission record simultaneously?
- What happens when a cache key collision occurs between two different data types?
- How are orphaned agent run records handled if their parent mission is deleted?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a typed data access layer for each core entity (Mission,
  AgentRun, KnowledgeEntry, WatchlistItem, Alert, Operator, RefreshToken) so that no other
  component writes raw data queries.
- **FR-002**: The data access layer MUST support concurrent access from multiple asynchronous
  callers without data corruption or deadlocks.
- **FR-003**: KnowledgeEntry records MUST support storage and retrieval of semantic vector
  embeddings for similarity-based search.
- **FR-004**: Similarity search on KnowledgeEntry MUST return results ranked by semantic relevance
  and support metadata-based filtering (source, confidence, freshness date).
- **FR-005**: The system MUST include a schema migration tool that applies all changes
  incrementally and idempotently to any target database.
- **FR-006**: The system MUST provide a shared cache store accessible to agents, background
  workers, and MCP servers for storing computed values with configurable time-to-live durations.
- **FR-007**: Cache entries MUST expire automatically after their configured TTL without manual
  intervention.
- **FR-008**: All data access operations MUST be covered by the test suite and MUST pass offline
  without a running database or cache server.
- **FR-009**: Each entity MUST carry sufficient metadata to support audit queries: who created it,
  when, its current status, and (for AgentRun) cost and performance measurements.
- **FR-010**: The data layer MUST enforce referential integrity between related entities (e.g.,
  AgentRun always belongs to a Mission; Alert always references a WatchlistItem).

### Key Entities

- **Mission**: A unit of work assigned to the agent team. Has a type, status lifecycle (pending →
  active → complete/failed), originating source (operator query, scheduled trigger, alert), and
  links to all agent runs produced during its execution.
- **AgentRun**: A record of a single agent's execution within a mission. Captures which agent ran,
  input/output snapshots, token usage, cost, latency, and outcome status.
- **KnowledgeEntry**: A curated fact or insight stored in the shared knowledge base. Contains text
  content, a semantic vector for similarity search, provenance metadata (source, author agent,
  confidence score, freshness timestamp), and conflict markers.
- **WatchlistItem**: An asset or condition being monitored. Stores the asset identifier, alert
  thresholds, monitoring frequency preference, and current status.
- **Alert**: A triggered event produced when a watchlist condition is met. References its source
  WatchlistItem, records the triggering condition, severity, and acknowledgement state.
- **Operator**: A registered user of the system. Stores identity, role (admin or viewer), Telegram
  handle, and account state.
- **RefreshToken**: A long-lived authentication credential linked to an Operator. Stores an opaque
  token value, expiry, and revocation state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Any single entity can be created and retrieved by the data access layer within 50
  milliseconds under normal operating conditions.
- **SC-002**: A similarity search across 10,000 knowledge entries returns ranked results in under
  500 milliseconds.
- **SC-003**: All schema migrations apply to an empty database in under 30 seconds.
- **SC-004**: Running migrations a second time on an already-migrated database completes in under
  5 seconds with zero errors.
- **SC-005**: The complete data layer test suite passes in under 60 seconds in an offline
  environment.
- **SC-006**: Zero data loss occurs when concurrent writes from multiple callers target the same
  entity, as verified by concurrent-write tests.

## Assumptions

- The production database supports vector similarity search natively; local offline tests run on
  SQLite and validate vector-related behavior through repository fallbacks and interface-level
  checks.
- All entities are identified by system-generated unique identifiers; no external IDs are used
  as primary keys.
- The cache store and the database are separate infrastructure components; the cache is not used
  as a persistent store for business data.
- Soft deletion (marking records as inactive) is preferred over hard deletion for Mission,
  KnowledgeEntry, and Alert records to preserve audit trails.
- The embedding vector dimension for KnowledgeEntry is fixed at a single value chosen during
  planning; changing it requires a migration.
- The data access layer is internal infrastructure; it does not expose an HTTP API — that is
  covered by Feature 003 (API & Auth).
- Offline testing uses an in-process test database fixture; the exact fixture mechanism is
  determined during planning within the offline constraint.
