# Research: Collector Agents

## Decision: Watchdog run mechanism

**Chosen**: Celery beat periodic task calling `watchdog_agent.run_watchdog_cycle()`. Schedule configured in `config/runtime/watchdog.yaml` under `schedule_cron`. The Celery worker picks up the task and runs the agent synchronously within the worker process.
**Rationale**: The spec states Watchdog runs on a schedule, not as a daemon. Celery beat is already in the stack for background tasks. Celery workers handle concurrency and retries. No new scheduler infrastructure needed.
**Alternatives considered**:
- APScheduler inside the FastAPI process: Ties the scheduler lifecycle to the web process. Rejected.
- Cron job calling an API endpoint: Requires HTTP auth setup and an exposed internal endpoint. Rejected.

---

## Decision: Watchdog threshold evaluation logic

**Chosen**: For each `WatchlistItem`, call the market-data MCP tool to get current price and volume, and the news-macro tool to get recent news count. Compare against thresholds from `watchdog.yaml`: `price_change_pct_threshold`, `volume_spike_multiplier`, `news_count_window_minutes`, `news_count_threshold`. If any condition met and no duplicate alert exists within `deduplication_window_minutes`, create `Alert` and `Mission` records.
**Rationale**: Thresholds are data-driven (from YAML), the comparison logic is deterministic, and the LLM is only used for generating the alert description string — not for deciding whether to alert. This keeps the Watchdog fast and predictable.
**Alternatives considered**:
- LLM decides whether to alert: Non-deterministic; would make deduplication and testing hard. Rejected.
- Watchdog fetches all data in one batched call: MCP tools are per-symbol; batching would require a new tool not in spec. Rejected.

---

## Decision: Deduplication strategy for Watchdog alerts

**Chosen**: Before creating an Alert, query the `alerts` table for any existing alert with `(watchlist_item_id, condition_type)` where `created_at > now() - deduplication_window_minutes`. If found, skip. This is a simple DB query — no Redis lock needed for daily-cadence monitoring.
**Rationale**: The spec says deduplication window is configurable. A DB query is sufficient for the expected frequency (minutes to hours). No distributed lock needed since Watchdog runs are sequential within a Celery worker.
**Alternatives considered**:
- Redis SET with TTL: Would work but adds Redis dependency to a logic path that already has DB access. Overkill. Rejected.
- Application-level set in memory: Lost on worker restart. Rejected.

---

## Decision: ResearchPacket structure

**Chosen**: `ResearchPacket` Pydantic model in `packages/shared/src/finsight/shared/models/data_packet.py`. Fields:
- `mission_id: UUID`
- `target_symbol: str`
- `target_theme: str | None`
- `price_history: list[PriceBar]`
- `fundamentals: FundamentalData | None`
- `news_items: list[NewsItem]`
- `knowledge_entries: list[KnowledgeEntry]`
- `tool_errors: list[ToolError]`
- `collected_at: datetime`

Each sub-model is also in `packages/shared`. `tool_errors` holds any failed tool call descriptions so the Analyst knows which data is absent without raising exceptions.
**Rationale**: The spec requires that absent data is recorded explicitly, not silently omitted. `tool_errors` satisfies this. Pydantic validation ensures the output schema is always conformant.
**Alternatives considered**:
- Dict with optional keys: Not typed; violates mypy --strict. Rejected.
- Separate Packet models per agent: Over-engineering for two agents. A single ResearchPacket covers both Watchdog and Researcher needs. Accepted.

---

## Decision: Researcher agent LLM usage

**Chosen**: The Researcher does NOT use an LLM for data collection. It directly calls MCP tools via the `MCPClient`, assembles results into a `ResearchPacket`, and returns. The LLM is only used if a query-reformulation step is needed (e.g., building the knowledge-base search query string from the mission context) — in that case, a minimal prompt in `researcher_agent.prompt.py` is used.
**Rationale**: The spec is explicit: Researcher returns only factual data with no analysis. Using an LLM for the core collection step would introduce non-determinism and cost. Tool calls are deterministic.
**Alternatives considered**:
- Full LLM orchestration of tool calls (ReAct): Would allow flexible tool selection but introduces the risk of the LLM adding interpretive content. Spec prohibits this. Rejected.
- No LLM at all: Acceptable for basic missions; a minimal LLM step for knowledge-base query construction is kept optional, gated by config.

---

## Decision: Alert severity levels

**Chosen**: Enum `AlertSeverity` with values `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Mapping from threshold-breach magnitude to severity defined in `watchdog.yaml` (e.g., `price_change_pct >= 5 → MEDIUM`, `>= 10 → HIGH`). The Watchdog sets severity deterministically from config.
**Rationale**: Configurable severity mapping means the operator can tune sensitivity without code changes. The Watchdog never asks an LLM to judge severity.
**Alternatives considered**:
- Fixed severity per condition type: Less flexible; a 1% price move and a 20% price move would get the same severity. Rejected.
- LLM-assigned severity: Non-deterministic; not appropriate for a threshold monitor. Rejected.

---

## Decision: Offline test approach for collector agents

**Chosen**: `respx` to mock all `httpx` calls made by `MCPClient`. `AsyncMock` to mock `BaseChatModel.ainvoke` for the optional LLM step in Researcher. SQLAlchemy `AsyncSession` mocked with `AsyncMock` for DB writes in Watchdog. Fixtures provide realistic WatchlistItem, price response, and news response data.
**Rationale**: Same pattern as Feature 005. Consistent test infrastructure across all agents. No Docker, no network, no LM Studio required.
**Alternatives considered**:
- SQLite in-memory for DB tests: Possible but pgvector operators are not available in SQLite. Using AsyncMock for the session is simpler and avoids DB dialect issues. Accepted.
