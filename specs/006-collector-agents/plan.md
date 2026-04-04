# Implementation Plan: Collector Agents

**Branch**: `006-collector-agents` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Implement the Watchdog agent (monitors price/volume/news thresholds from watchdog.yaml → creates
Alert records + opens Missions on breach) and the Researcher agent (assembles a typed
ResearchPacket from MCP tool calls — price history, fundamentals, news, KB entries — without
any interpretation). Both extend BaseAgent from Feature 005 and are tested offline with respx +
mocked LLM responses.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: langchain-core, langchain-openai, structlog (from Feature 005 infra)
**Storage**: PostgreSQL (WatchlistItem, Alert, Mission reads/writes via Feature 002 repos)
**Testing**: pytest + pytest-asyncio + unittest.mock + respx (offline)
**Target Platform**: Linux server (Docker) as Celery worker tasks
**Project Type**: Agent implementations (apps/api-service sub-package)
**Performance Goals**: Watchdog evaluates 50 items in < 30 s; Researcher assembles packet in < 60 s
**Constraints**: mypy --strict; offline tests; Researcher output contains ONLY factual data
**Scale/Scope**: 2 agents; watchlist up to 50 items

## Constitution Check

- [x] Everything-as-Code — thresholds, dedup window, run frequency in config/runtime/watchdog.yaml
- [x] Agent Boundaries — Researcher collects ONLY (no interpretation); Watchdog monitors ONLY (no analysis)
- [x] MCP Server Independence — both agents call tools via MCPClient; never import MCP server code
- [x] Cost Observability — both agents extend BaseAgent; all LLM calls recorded automatically
- [x] Fail-Safe Defaults — partial tool failure → ResearchPacket records absence; no silent errors
- [x] Test-First — offline tests with mocked MCP responses and mocked LLM
- [x] Simplicity Over Cleverness — Watchdog is a simple threshold evaluator; Researcher is a data fetcher

## Project Structure

### Source Code

```text
apps/api-service/src/api/agents/
├── watchdog_agent.py        # WatchdogAgent: evaluates thresholds, creates Alert + Mission
├── watchdog_agent.prompt.py # WatchdogAgent system prompt
├── researcher_agent.py      # ResearcherAgent: calls MCP tools, returns ResearchPacket
└── researcher_agent.prompt.py

packages/shared/src/finsight/shared/models/
├── research_packet.py       # ResearchPacket Pydantic model (Researcher output)
└── alert.py                 # Alert model (already in Feature 002; ensure AlertSeverity enum)

config/runtime/
└── watchdog.yaml            # price_change_pct, volume_spike_multiplier, news_spike_rate, dedup_window_hours

config/schemas/
└── watchdog.py              # Pydantic v2 schema

apps/api-service/tests/agents/
├── test_watchdog.py         # threshold breach → alert created; no breach → no alert; dedup
└── test_researcher.py       # packet fields populated; no interpretation; absent data recorded
```

## Implementation Phases

### Phase 1: Config

**Files**: `config/runtime/watchdog.yaml`, `config/schemas/watchdog.py`

**Key decisions**:
- `price_change_pct_threshold: 3.0` (default 3% move triggers alert)
- `volume_spike_multiplier: 2.0` (2x average volume)
- `news_spike_rate_per_hour: 5` (>5 articles/hour for a symbol)
- `dedup_window_hours: 4` (no duplicate alert for same condition within 4h)

### Phase 2: Shared ResearchPacket Model

**Files**: `packages/shared/src/finsight/shared/models/research_packet.py`

**Key decisions**:
- `ResearchPacket` fields: `ticker: str`, `price_history: list[OHLCVBar] | None`, `fundamentals: FundamentalsData | None`, `news_items: list[NewsItem]`, `kb_entries: list[KnowledgeResult]`, `data_gaps: list[str]` (records what was absent)
- All sub-models also in packages/shared

### Phase 3: Watchdog Agent

**Files**: `apps/api-service/src/api/agents/watchdog_agent.py` + `.prompt.py`

**Key decisions**:
- Calls `MCPClient.call_tool("market.get_price", ...)` and `MCPClient.call_tool("news.get_news", ...)` for each watchlist item
- **No LLM call**: the Watchdog is a pure threshold evaluator. Alert descriptions are
  generated programmatically using string formatting, e.g. `"SPY price moved +3.2% exceeding
  the 3.0% threshold"`. This keeps `cost_usd=0` in AgentRun, eliminates the need to mock an
  LLM in tests, and produces more reliable and consistent alert text than an LLM would.
- **Threshold precedence**: if a WatchlistItem row has a non-null `price_change_pct_threshold`
  field (or equivalent per-item threshold columns), that value takes precedence over the global
  default in `watchdog.yaml`. A null per-item field falls back to the `watchdog.yaml` default.
  This allows per-symbol customisation (e.g. tighter threshold for volatile assets) without
  requiring YAML edits.
- Dedup: `AlertRepository.get_recent(ticker, condition, window_hours)` before creating new alert
- Opens mission via `MissionRepository.create(...)` linked to the alert
- Watchdog has no prompt file — `watchdog_agent.prompt.py` contains only a module-level
  docstring documenting the threshold evaluation logic. No system prompt is needed.

### Phase 4: Researcher Agent

**Files**: `apps/api-service/src/api/agents/researcher_agent.py` + `.prompt.py`

**Key decisions**:
- Input: `ResearchInput(ticker: str, mission_id: UUID)`
- Calls: price history, fundamentals, news, KB search via MCPClient
- Absent data recorded in `data_gaps` list (e.g., `"fundamentals: tool returned no data"`)
- Output schema: `ResearchPacket` — strictly no analytical fields (validated by schema)
- NO LLM call in Researcher (pure data assembly); cost_usd=0 in AgentRun

### Phase 5: Tests

**Files**: `apps/api-service/tests/agents/test_watchdog.py`, `test_researcher.py`

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Watchdog LLM use | None — alert descriptions are f-strings | Deterministic text is more reliable; eliminates mock complexity; cost=0 |
| Researcher LLM use | None | Data assembly needs no reasoning |
| Absent data | Explicit data_gaps field | Spec FR-009: absence recorded clearly |
| Dedup | DB query before creating alert | Prevents duplicate missions for same breach |

## Testing Strategy

- Watchdog: mock MCPClient returning price above threshold → verify Alert + Mission created
- Watchdog: mock price below threshold → verify no Alert created
- Watchdog: second breach within dedup window → verify no duplicate Alert
- Researcher: mock all 4 MCP tools → verify all ResearchPacket fields populated
- Researcher: mock news tool returns empty → verify `data_gaps` contains "news: no data"
- Researcher output: assert no fields named "analysis", "recommendation", "conclusion"

## Dependencies

- **Requires**: 005-agent-infrastructure (BaseAgent, MCPClient), 002 (repos), 004 (MCP servers)
- **Required by**: 007-reasoning-agents, 008-orchestration
