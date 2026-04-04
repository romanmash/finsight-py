# Data Model: Async Data Layer

**Feature**: `002-async-data-layer` | **Date**: 2026-04-02

## Entity Overview

```
Operator ──< RefreshToken
Operator ──< Mission
Mission  ──< AgentRun
Mission  ──< Alert (via WatchlistItem)
WatchlistItem ──< Alert
KnowledgeEntry  (standalone; written by Bookkeeper only)
```

---

## Operator

**Purpose**: Registered system user. Admin or viewer role.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default `gen_random_uuid()` | |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login identifier |
| `hashed_password` | VARCHAR(255) | NOT NULL | bcrypt hash |
| `role` | VARCHAR(20) | NOT NULL, default `'viewer'` | `'admin'` or `'viewer'` |
| `telegram_handle` | VARCHAR(64) | NULLABLE | e.g. `@username` |
| `telegram_user_id` | BIGINT | NULLABLE, UNIQUE | Telegram user identifier |
| `telegram_chat_id` | VARCHAR(64) | NULLABLE | Telegram chat identifier |
| `is_active` | BOOLEAN | NOT NULL, default `true` | Soft disable |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `now()` | Updated by trigger/ORM |

**Pydantic domain model** (`packages/shared`):
```python
class OperatorModel(BaseModel):
    id: UUID
    email: str
    role: Literal["admin", "viewer"]
    telegram_handle: str | None
    telegram_user_id: int | None
    telegram_chat_id: str | None
    is_active: bool
    created_at: datetime
```
Password hash is never included in the domain model.

---

## RefreshToken

**Purpose**: Long-lived auth credential. Rotated on each use.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `operator_id` | UUID | FK → Operator.id, NOT NULL | |
| `token_hash` | VARCHAR(64) | UNIQUE, NOT NULL | SHA-256 of raw token |
| `expires_at` | TIMESTAMPTZ | NOT NULL | |
| `revoked_at` | TIMESTAMPTZ | NULLABLE | Set on logout/rotation |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` | |

---

## Mission

**Purpose**: A unit of work for the agent team. Status lifecycle: `pending → running → completed | failed | cancelled`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `operator_id` | UUID | FK → Operator.id, NULLABLE | NULL = system-triggered |
| `title` | VARCHAR(255) | NOT NULL | Human-readable summary |
| `query` | TEXT | NOT NULL | Original user query or trigger description |
| `mission_type` | VARCHAR(50) | NOT NULL | `'research'`, `'screen'`, `'brief'`, `'alert'` |
| `status` | VARCHAR(20) | NOT NULL, default `'pending'` | |
| `source` | VARCHAR(20) | NOT NULL | `'operator'`, `'scheduled'`, `'alert'` |
| `result_summary` | TEXT | NULLABLE | Final output (populated on completion) |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |
| `completed_at` | TIMESTAMPTZ | NULLABLE | |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | Soft delete |

**Indexes**: `status`, `operator_id`, `created_at DESC`

---

## AgentRun

**Purpose**: Record of a single agent's execution within a mission. Cost and performance tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `mission_id` | UUID | FK → Mission.id, NOT NULL | Cascade delete |
| `agent_name` | VARCHAR(50) | NOT NULL | e.g. `'researcher'`, `'analyst'` |
| `status` | VARCHAR(20) | NOT NULL | `'running'`, `'completed'`, `'failed'` |
| `input_snapshot` | JSONB | NULLABLE | Serialized input payload |
| `output_snapshot` | JSONB | NULLABLE | Serialized output payload |
| `tokens_in` | INTEGER | NOT NULL, default 0 | |
| `tokens_out` | INTEGER | NOT NULL, default 0 | |
| `cost_usd` | NUMERIC(12,8) | NOT NULL, default 0 | |
| `provider` | VARCHAR(50) | NULLABLE | e.g. `'openai'` |
| `model` | VARCHAR(100) | NULLABLE | e.g. `'gpt-4o-mini'` |
| `duration_ms` | INTEGER | NULLABLE | Wall-clock time |
| `error_message` | TEXT | NULLABLE | On failure |
| `started_at` | TIMESTAMPTZ | NOT NULL, default `now()` | |
| `completed_at` | TIMESTAMPTZ | NULLABLE | |

**Indexes**: `mission_id`, `agent_name`, `started_at DESC`

---

## KnowledgeEntry

**Purpose**: Curated fact/insight in the shared knowledge base. Written only by Bookkeeper.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `content` | TEXT | NOT NULL | The knowledge text |
| `embedding` | VECTOR(1536) | NULLABLE | Semantic embedding |
| `source_url` | TEXT | NULLABLE | Origin URL |
| `source_type` | VARCHAR(50) | NULLABLE | `'news'`, `'filing'`, `'analysis'` |
| `author_agent` | VARCHAR(50) | NOT NULL | Must be `'bookkeeper'` |
| `confidence` | NUMERIC(3,2) | NOT NULL, default 0.5 | 0.0–1.0 |
| `tickers` | TEXT[] | NOT NULL, default `'{}'` | Associated ticker symbols |
| `tags` | TEXT[] | NOT NULL, default `'{}'` | Topic tags |
| `freshness_date` | DATE | NULLABLE | When the underlying information is from |
| `conflict_marker` | BOOLEAN | NOT NULL, default false | Flagged as conflicting with another entry |
| `mission_id` | UUID | FK → Mission.id, NULLABLE | Source mission |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` | |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | Soft delete |

**Indexes**: IVFFlat index on `embedding` for cosine similarity; `tickers` GIN index; `tags` GIN index; `freshness_date`

---

## WatchlistItem

**Purpose**: An asset or condition being monitored by Watchdog.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `ticker` | VARCHAR(20) | NOT NULL | e.g. `'AAPL'` |
| `label` | VARCHAR(100) | NULLABLE | Human-readable name |
| `is_active` | BOOLEAN | NOT NULL, default true | |
| `price_alert_above` | NUMERIC(18,4) | NULLABLE | |
| `price_alert_below` | NUMERIC(18,4) | NULLABLE | |
| `volume_spike_multiplier` | NUMERIC(5,2) | NULLABLE | e.g. 3.0 = 3× avg volume |
| `rsi_overbought` | NUMERIC(5,2) | NULLABLE | e.g. 70.0 |
| `rsi_oversold` | NUMERIC(5,2) | NULLABLE | e.g. 30.0 |
| `check_interval_minutes` | INTEGER | NOT NULL, default 60 | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

---

## Alert

**Purpose**: A triggered event when a watchlist condition is met.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `watchlist_item_id` | UUID | FK → WatchlistItem.id, NOT NULL | |
| `trigger_condition` | TEXT | NOT NULL | Human-readable description |
| `trigger_value` | NUMERIC(18,4) | NULLABLE | Actual value that triggered |
| `severity` | VARCHAR(20) | NOT NULL | `'info'`, `'warning'`, `'critical'` |
| `acknowledged_at` | TIMESTAMPTZ | NULLABLE | NULL = unacknowledged |
| `acknowledged_by` | UUID | FK → Operator.id, NULLABLE | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` | |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | Soft delete |

**Indexes**: `acknowledged_at`, `created_at DESC`, `watchlist_item_id`

---

## Relationships Summary

```
Operator (1) ──< (N) RefreshToken        [operator_id, hard delete cascade]
Operator (1) ──< (N) Mission             [operator_id, SET NULL on operator delete]
Mission  (1) ──< (N) AgentRun            [mission_id, CASCADE DELETE]
Mission  (1) ──< (N) KnowledgeEntry      [mission_id, SET NULL]
WatchlistItem (1) ──< (N) Alert          [watchlist_item_id, RESTRICT delete]
```

---

## Alembic Migration: `001_initial_schema`

Operations in order:
1. `CREATE EXTENSION IF NOT EXISTS vector`
2. `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`
3. Create `operators` table
4. Create `refresh_tokens` table
5. Create `missions` table
6. Create `agent_runs` table
7. Create `knowledge_entries` table (including `VECTOR(1536)` column)
8. Create IVFFlat index on `knowledge_entries.embedding`
9. Create `watchlist_items` table
10. Create `alerts` table
11. Create all secondary indexes
