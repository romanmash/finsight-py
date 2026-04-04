# Data Model: Reasoning Agents (007)

## ThesisImpact

**Type**: Python `enum.Enum`
**Location**: `packages/shared/src/finsight/shared/models/assessment.py`

| Value | Description |
|-------|-------------|
| SUPPORTS | Evidence supports the operator's existing thesis for the asset |
| CONTRADICTS | Evidence contradicts or challenges the thesis |
| NEUTRAL | No significant bearing on the thesis |

---

## Assessment

**Type**: Pydantic v2 BaseModel
**Location**: `packages/shared/src/finsight/shared/models/assessment.py`

| Field | Python Type | Description | Constraints |
|-------|-------------|-------------|-------------|
| ticker | str | Asset ticker symbol (e.g., "GOLD", "AAPL") | min_length=1, max_length=12 |
| significance_explanation | str | Why the observed data/events matter in context | min_length=10 |
| thesis_impact | ThesisImpact | Whether evidence supports, contradicts, or is neutral to thesis | enum |
| thesis_rationale | str | Explanation of how evidence relates to the thesis | min_length=10 |
| identified_risks | list[str] | Discrete risk factors extracted from the packet | min_items=0 |
| confidence_level | float | Analyst's confidence in the assessment (0.0–1.0) | ge=0.0, le=1.0 |
| conflicting_signals | list[str] | Signals from the packet that point in opposite directions | default=[] |
| data_gaps | list[str] | Information the Analyst wanted but was absent from the packet | default=[] |
| mission_id | UUID | Mission this assessment belongs to | |
| agent_run_id | UUID | FK to AgentRun for cost tracking | |
| created_at | datetime | UTC timestamp of creation | auto |

**Notes**: `Assessment` is not persisted directly — it is passed through the graph and stored by the Bookkeeper as a `KnowledgeEntry`. `agent_run_id` links back to cost tracking.

---

## PatternType

**Type**: Python `enum.Enum`
**Location**: `packages/shared/src/finsight/shared/models/pattern_report.py`

| Value | Description |
|-------|-------------|
| TREND_UP | Sustained upward price structure |
| TREND_DOWN | Sustained downward price structure |
| SIDEWAYS | Consolidation / range-bound |
| BREAKOUT | Price exiting a defined range |
| REVERSAL | Confirmed change in trend direction |
| ACCUMULATION | Low-volatility volume-weighted building phase |
| DISTRIBUTION | High-volume selling phase |
| NO_PATTERN | Insufficient data or no identifiable pattern |

---

## PatternObservation

**Type**: Pydantic v2 BaseModel
**Location**: `packages/shared/src/finsight/shared/models/pattern_report.py`

| Field | Python Type | Description | Constraints |
|-------|-------------|-------------|-------------|
| observation | str | Technical observation (e.g., "50-day MA crossed above 200-day MA") | min_length=5 |
| supporting_data_points | list[str] | Specific price/volume values supporting the observation | |

---

## PatternReport

**Type**: Pydantic v2 BaseModel
**Location**: `packages/shared/src/finsight/shared/models/pattern_report.py`

| Field | Python Type | Description | Constraints |
|-------|-------------|-------------|-------------|
| ticker | str | Asset ticker symbol | min_length=1, max_length=12 |
| pattern_type | PatternType | Primary identified pattern | enum |
| pattern_name | str | Human-readable pattern label (e.g., "Golden Cross") | |
| observations | list[PatternObservation] | Supporting technical observations | min_items=0 |
| confidence_level | float | Confidence in pattern identification (0.0–1.0) | ge=0.0, le=1.0 |
| data_period_days | int | Number of trading days of price history analysed | gt=0 |
| insufficient_data | bool | True if fewer than minimum required bars were available | default=False |
| mission_id | UUID | Mission this report belongs to | |
| agent_run_id | UUID | FK to AgentRun for cost tracking | |
| created_at | datetime | UTC timestamp of creation | auto |

**Invariant**: `PatternReport` MUST NOT contain fields named `recommendation`, `action`, `buy`, `sell`, or `price_target`. Validated by test schema inspection.

---

## ProvenanceRecord

**Type**: Pydantic v2 BaseModel
**Location**: `packages/shared/src/finsight/shared/models/knowledge_entry.py`

| Field | Python Type | Description | Constraints |
|-------|-------------|-------------|-------------|
| source_agent | str | Agent class name that produced the source output | |
| mission_id | UUID | Mission that generated this information | |
| confidence | float | Source agent's confidence at time of write | ge=0.0, le=1.0 |
| recorded_at | datetime | UTC timestamp when this provenance record was added | auto |
| input_hash | str | SHA-256 hash of the source payload | |

---

## KnowledgeEntry

**Type**: SQLAlchemy 2.x async ORM model + Pydantic v2 schema
**Location**: `packages/shared/src/finsight/shared/models/knowledge_entry.py` (Pydantic schema), `apps/api-service/src/api/models/knowledge_entry_orm.py` (SQLAlchemy ORM)

| Field | Python Type | DB Column | Description | Constraints |
|-------|-------------|-----------|-------------|-------------|
| id | UUID | `id` UUID PK | Primary key | auto-generated |
| ticker | str | `ticker` VARCHAR(12) | Asset ticker | NOT NULL, indexed |
| entry_type | str | `entry_type` VARCHAR(50) | Category: "assessment", "pattern", "alert_summary" | NOT NULL |
| content_summary | str | `content_summary` TEXT | Human-readable summary of the entry | NOT NULL |
| content_hash | str | `content_hash` CHAR(64) | SHA-256 hash of (ticker + entry_type + content_summary) | UNIQUE per (ticker, entry_type), indexed |
| provenance_history | list[ProvenanceRecord] | `provenance_history` JSONB | Append-only list of provenance records | NOT NULL, default=[] |
| conflict_markers | list[str] | `conflict_markers` JSONB | Human-readable conflict descriptions | default=[] |
| confidence | float | `confidence` FLOAT | Current best-estimate confidence | ge=0.0, le=1.0 |
| embedding | Vector(1536) \| None | `embedding` vector(1536) | pgvector embedding (populated by Feature 004) | nullable |
| freshness_at | datetime | `freshness_at` TIMESTAMPTZ | UTC timestamp of most recent update | NOT NULL |
| created_at | datetime | `created_at` TIMESTAMPTZ | UTC timestamp of first write | auto |

**Relationships**: `KnowledgeEntry` is standalone — no FK to `Mission` (missions are ephemeral, KB is persistent). Provenance history in JSONB preserves mission references without hard FK constraint.

---

## FormattedReport

**Type**: Pydantic v2 BaseModel
**Location**: `packages/shared/src/finsight/shared/models/report.py`

| Field | Python Type | Description | Constraints |
|-------|-------------|-------------|-------------|
| mission_id | UUID | Mission this report was generated for | |
| delivery_surface | Literal["telegram", "dashboard"] | Target rendering surface | |
| title | str | Short title (used as Telegram message header or dashboard card title) | max_length=100 |
| sections | list[ReportSection] | Ordered list of content sections | min_items=1 |
| total_char_count | int | Pre-computed character count for Telegram chunking logic | |
| created_at | datetime | UTC timestamp of formatting | auto |

---

## ReportSection

**Type**: Pydantic v2 BaseModel
**Location**: `packages/shared/src/finsight/shared/models/report.py`

| Field | Python Type | Description | Constraints |
|-------|-------------|-------------|-------------|
| heading | str | Section heading (e.g., "Assessment", "Technical Pattern") | |
| body | str | Formatted text content for this section | |
| source_agent | str | Agent class name that produced the content in this section | |
