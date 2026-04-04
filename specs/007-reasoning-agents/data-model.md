# Data Model: Reasoning Agents (007)

## Assessment

**Type**: Pydantic v2 BaseModel  
**Location**: `packages/shared/src/finsight/shared/models/assessment.py`

| Field | Type | Notes |
|---|---|---|
| `significance` | `str` | Why the event matters |
| `thesis_impact` | `ThesisImpact` | `supports` \| `contradicts` \| `neutral` |
| `thesis_rationale` | `str` | Why this impact was selected |
| `risks` | `list[RiskItem]` | Each risk has `description` + `severity` (`low/medium/high`) |
| `confidence` | `float` | `0.0` to `1.0` |
| `data_limitations` | `list[str]` | Missing/uncertain context |

---

## PatternReport

**Type**: Pydantic v2 BaseModel  
**Location**: `packages/shared/src/finsight/shared/models/pattern_report.py`

| Field | Type | Notes |
|---|---|---|
| `pattern_type` | `PatternType` | Includes `NO_PATTERN` |
| `pattern_name` | `str \| None` | Human-readable label |
| `confidence` | `float` | `0.0` to `1.0` |
| `observations` | `list[PatternObservation]` | Observation + supporting data |
| `timeframe` | `str` | e.g. `1 month` |
| `no_pattern_rationale` | `str \| None` | Set when no clear structure exists |

**Invariant**: no advice fields (`recommendation`, `action`, `buy`, `sell`, `price_target`).

---

## FormattedReport

**Type**: Pydantic v2 BaseModel  
**Location**: `packages/shared/src/finsight/shared/models/report.py`

| Field | Type | Notes |
|---|---|---|
| `title` | `str` | Delivery title |
| `sections` | `list[ReportSection]` | Section title + content |
| `full_text` | `str` | Auto-truncated to Telegram 4096 chars with `[Truncated]` suffix |
| `ticker` | `str \| None` | Optional |
| `mission_id` | `UUID` | Mission reference |
| `generated_at` | `datetime` | UTC default |

---

## KnowledgeEntry (Domain + ORM)

**Domain Model**: `packages/shared/src/finsight/shared/models/knowledge_entry.py`  
**ORM Model**: `apps/api-service/src/api/db/models/knowledge_entry.py`

`BookkeeperAgent` writes deterministic KB rows with:
- hash-based dedupe key: `content_hash`
- compatibility columns consumed by RAG retrieval: `content`, `source_type`, `author_agent`,
  `tickers`, `tags`, `freshness_date`, `deleted_at`
- 007-specific metadata: `ticker`, `entry_type`, `content_summary`, `freshness_at`,
  `provenance_history`, `conflict_markers`

This keeps 007 reasoning writes compatible with existing retrieval tools while preserving richer
provenance/conflict tracking for later graph steps.
