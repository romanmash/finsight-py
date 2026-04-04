# Feature Specification: Collector Agents

**Feature Branch**: `006-collector-agents`
**Created**: 2026-04-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Watchdog Detects a Price Threshold Breach and Raises an Alert (Priority: P1)

The Watchdog agent continuously monitors price and volatility data for all assets on the
watchlist. When an asset's price moves beyond a configured threshold, or unusual volume is
detected, the Watchdog creates an Alert record and opens a new Mission for the agent team to
investigate. The operator does not need to be watching — the alert is raised automatically.

**Why this priority**: Automated threshold monitoring is the primary trigger for the entire
agent pipeline. Without the Watchdog, the system is reactive only to manual operator queries.

**Independent Test**: Configure a watchlist item with a threshold, simulate a price move that
breaches it, verify an Alert record is created and a new Mission is opened.

**Acceptance Scenarios**:

1. **Given** a watchlist item with a price threshold configured, **When** the monitored price
   crosses that threshold, **Then** an Alert record is created and a Mission is opened for
   investigation.
2. **Given** a watchlist item whose price has not crossed any threshold, **When** the Watchdog
   runs, **Then** no alert is raised and no new mission is opened.
3. **Given** multiple watchlist items, **When** the Watchdog runs, **Then** each item is
   evaluated independently and alerts are raised only for items where conditions are met.

---

### User Story 2 — Researcher Assembles a Research Packet for a Mission (Priority: P1)

The Manager assigns the Researcher agent to gather supporting information for an active mission.
The Researcher calls market data and news tools to collect price history, fundamentals, and recent
news. It also queries the knowledge base for past notes relevant to the asset or theme. It
packages all collected data into a structured Research Packet and returns it — without drawing
any conclusions or offering interpretations.

**Why this priority**: The Researcher is the data intake for every investigation. Without it,
the Analyst and other reasoning agents have no structured evidence to work with.

**Independent Test**: Trigger the Researcher for a test mission, verify it calls the expected
tools, verify the returned Research Packet contains all required data fields, and verify no
interpretive or analytical content is present in the output.

**Acceptance Scenarios**:

1. **Given** an active mission for a specific asset, **When** the Researcher runs, **Then** it
   returns a Research Packet containing price history, fundamental data, recent news items, and
   relevant past knowledge entries.
2. **Given** a Researcher run, **When** the output is inspected, **Then** it contains only
   factual data — no analysis, no conclusions, no recommendations.
3. **Given** a tool call that returns no data (e.g., no news for an obscure asset), **When** the
   Researcher runs, **Then** the Research Packet reflects the absence of data clearly rather than
   omitting the field or raising an error.

---

### User Story 3 — Watchdog Detects Unusual News Volume and Triggers Triage (Priority: P2)

Beyond price thresholds, the Watchdog monitors news volume for watched assets and themes. A
sudden spike in news publication rate — even without a price move — can signal an emerging
situation. The Watchdog detects this, creates an alert at the appropriate severity level, and
opens a mission.

**Why this priority**: News-based monitoring catches market-moving events before price reacts,
giving the operator an earlier signal. It extends the Watchdog's value significantly.

**Independent Test**: Inject a set of news items that simulates a publication spike for a watched
theme, run the Watchdog, verify an alert is raised at the appropriate severity.

**Acceptance Scenarios**:

1. **Given** a news volume threshold configured for a watched theme, **When** incoming news rate
   exceeds that threshold, **Then** an alert is raised with severity reflecting the magnitude of
   the spike.
2. **Given** normal news volume for a watched theme, **When** the Watchdog runs, **Then** no
   news-volume alert is raised.

---

### Edge Cases

- What happens if the market data tool is unavailable when the Watchdog runs?
- How does the Researcher handle a partial tool failure (some tools succeed, others fail)?
- What if the Watchdog detects the same threshold breach multiple times in rapid succession?
- How are watchlist items with missing or stale data treated by the Watchdog?
- What if the Researcher is given a mission for an asset not supported by any data tool?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Watchdog agent MUST monitor all active watchlist items on each scheduled run
  and evaluate configured price, volatility, and news-volume thresholds.
- **FR-002**: The Watchdog MUST create an Alert record and open a Mission when any threshold is
  breached, recording the triggering condition and the observed value.
- **FR-003**: The Watchdog MUST NOT open duplicate missions for the same threshold breach within
  a configurable deduplication window.
- **FR-004**: The Researcher agent MUST collect price history, fundamental data, and recent news
  for the mission's target asset or theme using MCP tools.
- **FR-005**: The Researcher MUST query the knowledge base for past entries relevant to the
  mission target and include them in the Research Packet.
- **FR-006**: The Researcher MUST return a typed Research Packet containing only factual data —
  no analysis, interpretations, or recommendations.
- **FR-007**: Both agents MUST record their runs via the agent infrastructure (tokens, cost,
  duration) and MUST be traceable in the observability platform.
- **FR-008**: Both agents MUST be testable offline with mocked tool responses and mocked
  repository interactions (no real network or LLM runtime).
- **FR-009**: Watchdog run frequency and alert thresholds MUST be configurable in YAML without
  code changes.

### Key Entities

- **WatchlistItem**: An asset or theme being monitored with configured thresholds (covered in
  Feature 002). The Watchdog reads these.
- **Alert**: A triggered event created when a threshold is breached (covered in Feature 002).
  The Watchdog writes these.
- **ResearchPacket**: The structured output of a Researcher run. Contains price data, fundamental
  data, news items, and retrieved knowledge entries, all attributed to their sources.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Watchdog evaluates all active watchlist items and completes its run in under
  30 seconds for a watchlist of up to 50 items.
- **SC-002**: An alert is raised within one Watchdog run cycle of a threshold being breached.
- **SC-003**: The Researcher assembles a complete Research Packet for a single-asset mission in
  under 60 seconds under normal conditions.
- **SC-004**: Zero duplicate missions are opened for the same threshold breach within the
  deduplication window, verified by test cases.
- **SC-005**: All collector agent tests pass offline in under 60 seconds.
- **SC-006**: The Researcher output contains no analytical or interpretive content, verified by
  automated output schema validation in 100% of test cases.

## Assumptions

- The Watchdog runs on a schedule managed by the background task system (configured in YAML);
  it does not run continuously as a daemon.
- Threshold definitions (price move percentage, volume multiplier, news spike rate) are stored
  in `config/runtime/watchdog.yaml` and are editable without code changes.
- The Researcher is always invoked by the Manager as part of a mission; it is never triggered
  directly by the operator.
- When a tool returns no data, the Researcher records the absence explicitly in the Research
  Packet; it does not re-try with a different tool unless explicitly configured to do so.
- The Watchdog deduplication window (time between repeated alerts for the same condition) is
  configurable and defaults to a value suitable for daily monitoring cadence.
