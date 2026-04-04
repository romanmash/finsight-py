# Research: Collector Agents

## Decision: Runtime model (no LLM for collectors)

**Chosen**: Watchdog and Researcher are deterministic collectors with no LLM calls.

**Rationale**:
- Matches strict boundary rule: collectors collect only.
- Lower cost and lower latency.
- Easier offline testing and reproducibility.

**Consequence**:
- They do not rely on `BaseAgent.run()` LLM path.
- They still persist `AgentRun` records with zero token/cost fields.

---

## Decision: Watchdog scheduling and threshold source

**Chosen**: Use existing watchdog config structure and extend it minimally.

Current shape retained:
- `poll_interval_seconds`
- `alert_cooldown_seconds`
- `default_thresholds.*`

Added in 006:
- `news_spike_rate_per_hour`
- `news_fetch_limit`
- `dedup_window_hours`

Researcher MCP fetch parameters are also YAML-driven via `researcher.yaml`:
- `ohlcv_period`
- `news_limit`
- `kb_limit`

**Rationale**:
- Avoids breaking 001/005 config loading.
- Keeps everything-as-code with minimal churn.

---

## Decision: Deduplication strategy

**Chosen**: DB-level recent-alert query through `AlertRepository.get_recent(...)` keyed by
structured `condition_type`.

**Rationale**:
- Deterministic and testable.
- No Redis lock complexity required for expected cadence.

---

## Decision: ResearchPacket schema location and shape

**Chosen**: `packages/shared/src/finsight/shared/models/research_packet.py` with explicit
`data_gaps` field.

Core fields:
- `ticker`, `mission_id`
- `price_history`, `fundamentals`, `news_items`, `kb_entries`
- `data_gaps`

**Rationale**:
- Strict typing for downstream reasoning agents.
- Explicit missing-data semantics required by the spec.

---

## Decision: Prerequisite handling

**Chosen**: 006 prefers Feature 002 entities/repos when present; if absent in branch context,
006 includes minimal compatible ORM/repository implementations for:
`WatchlistItem`, `Alert`, `Mission`, `AgentRun`.

**Rationale**:
- Keeps collector-agent delivery unblocked on branches missing full 002 artifacts.
- Maintains strict typing and offline testability.
