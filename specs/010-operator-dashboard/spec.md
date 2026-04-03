# Feature Specification: Operator Dashboard

**Feature Branch**: `010-operator-dashboard`
**Created**: 2026-04-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Operator Glances at the Screen and Understands the Current Situation (Priority: P1)

The operator sits at the Linux laptop that serves as the always-on mission console. The dashboard
is open fullscreen in a browser. At a glance they can see: which missions are active, the
current status of the watchlist, any unacknowledged alerts, and the most recent agent activity.
No login is required when accessed from the local machine.

**Why this priority**: The dashboard's primary value is instant situational awareness without
any interaction. If this story doesn't work, the dashboard has no value as an ops console.

**Independent Test**: Open the dashboard, verify the mission list, watchlist status, alert count,
and recent activity are all visible without any click or scroll on a standard laptop screen.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** the operator views it, **Then** active missions,
   watchlist status, unacknowledged alert count, and recent agent activity are all visible in
   the initial view.
2. **Given** a new alert is raised, **When** the dashboard refreshes, **Then** the alert count
   updates and the alert is visible without requiring a page reload.
3. **Given** a mission completes, **When** the dashboard refreshes, **Then** the mission moves
   from active to complete in the displayed list.

---

### User Story 2 — Operator Inspects a Mission's Full Evidence and Agent Reasoning (Priority: P1)

The operator clicks on a completed mission in the dashboard. A detail view opens showing the
full investigation: which agents ran, what data was collected, the Analyst's assessment, any
pattern findings, and the final summary. The operator can trace exactly why the system reached
its conclusion.

**Why this priority**: Explainability is central to the system's purpose. The operator must be
able to verify and understand every conclusion — not just receive opaque alerts.

**Independent Test**: Complete a test mission, open its detail view in the dashboard, verify all
agent outputs (Research Packet, Assessment, Pattern Report, final summary) are visible with their
source attributions.

**Acceptance Scenarios**:

1. **Given** a completed mission, **When** the operator opens its detail view, **Then** all agent
   outputs are displayed with labels identifying which agent produced each piece of content.
2. **Given** a mission detail view, **When** the operator scrolls through it, **Then** the full
   evidence chain from data collection through analysis to summary is traceable.

---

### User Story 3 — Operator Manages the Watchlist from the Dashboard (Priority: P2)

The operator adds a new asset to the watchlist, sets its alert thresholds, and saves the change.
The Watchdog picks up the new item on its next run. The operator can also disable or remove
existing items without touching configuration files.

**Why this priority**: The watchlist is the primary configuration the operator will change
regularly. Managing it through the dashboard is essential for daily usability.

**Independent Test**: Add a new watchlist item via the dashboard form, verify it appears in the
watchlist, verify it is retrievable from the database, then remove it and verify it is gone.

**Acceptance Scenarios**:

1. **Given** the operator is on the watchlist management page, **When** they add a new asset
   with thresholds, **Then** the asset appears in the list and is active on the next Watchdog run.
2. **Given** an existing watchlist item, **When** the operator disables it, **Then** the
   Watchdog no longer evaluates it until re-enabled.

---

### User Story 4 — Operator Browses and Queries the Knowledge Base (Priority: P2)

The operator opens the knowledge base section of the dashboard and searches for all entries
related to a specific company or theme. They can read the curated content, see the confidence
level, when it was last updated, and which agent wrote it.

**Why this priority**: The knowledge base is the system's accumulated intelligence. The operator
must be able to browse and verify it to trust the system's outputs.

**Independent Test**: Pre-populate the knowledge base with test entries, open the KB section,
search by entity name, verify matching entries are returned with their metadata.

**Acceptance Scenarios**:

1. **Given** knowledge entries exist for an entity, **When** the operator searches by entity
   name, **Then** matching entries are returned with content, confidence, freshness, and source.
2. **Given** entries with conflict markers, **When** displayed in the dashboard, **Then** the
   conflict is visually indicated so the operator can investigate.

---

### User Story 5 — Dashboard Is Usable by Touch on the Laptop's Touchscreen (Priority: P3)

The operator uses the touchscreen on the laptop to tap mission cards, acknowledge alerts, and
navigate between sections. The touch targets are large enough to use without a mouse or stylus.
Tap actions work without requiring hover states.

**Why this priority**: The laptop has a touchscreen and is used as a local console. Touch support
is a real usage requirement, not cosmetic.

**Independent Test**: Load the dashboard on the target device, use touch-only interactions to
navigate all primary sections, acknowledge an alert, and open a mission detail view.

**Acceptance Scenarios**:

1. **Given** the dashboard is open on the touchscreen device, **When** the operator taps a
   mission card, **Then** the detail view opens without requiring a mouse.
2. **Given** an unacknowledged alert, **When** the operator taps the acknowledge button, **Then**
   the alert is marked acknowledged and removed from the unacknowledged count.

---

### Edge Cases

- What happens when the API is unreachable and the dashboard cannot fetch data?
- How does the dashboard handle a very large number of missions (hundreds)?
- What if a mission is still in progress when its detail view is opened?
- How are long knowledge base entries displayed without overwhelming the interface?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST display active missions, watchlist status, unacknowledged alert
  count, and recent agent activity in the primary view without requiring any interaction.
- **FR-002**: The dashboard MUST update its data periodically so the operator sees near-real-time
  status without manual page reloads.
- **FR-003**: The dashboard MUST provide a mission detail view showing all agent outputs, evidence,
  and the full reasoning chain for any selected mission.
- **FR-004**: The dashboard MUST provide a watchlist management interface for adding, editing,
  disabling, and removing watchlist items and their thresholds.
- **FR-005**: The dashboard MUST provide a knowledge base browser with search by entity name and
  display of content, confidence, freshness, source agent, and conflict markers.
- **FR-006**: All interactive elements MUST have touch targets large enough for touchscreen use
  on a standard laptop display without a stylus.
- **FR-007**: The dashboard MUST display structured error messages when the API is unreachable
  rather than showing blank panels.
- **FR-008**: Admin-only actions (system configuration, operator management) MUST be hidden from
  viewer-role users.
- **FR-009**: The dashboard MUST be deployed as part of the same docker-compose stack as the rest
  of the system. It does not require any infrastructure beyond what the standard stack already
  provides. It runs as a separate container within that stack; it does not share a process with
  the API.

### Key Entities

- **MissionCard**: A summary view of a mission. Shows mission type, target, status, start time,
  and duration.
- **MissionDetail**: The full detail view of a mission. Shows all agent outputs in sequence with
  source labels.
- **WatchlistEditor**: The form-based interface for managing watchlist items and thresholds.
- **KnowledgeBrowser**: The search and display interface for the knowledge base.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The primary dashboard view loads and displays current data within 3 seconds of
  opening on the target hardware.
- **SC-002**: Data on the dashboard refreshes within 10 seconds of a change in the underlying
  system state.
- **SC-003**: A mission detail view loads completely within 2 seconds of selection.
- **SC-004**: All touch interactions respond within 300 milliseconds of the tap gesture on the
  target device.
- **SC-005**: The watchlist management interface allows adding a new item in under 1 minute
  without consulting documentation.

## Assumptions

- The dashboard is accessed exclusively from the local network; it is not exposed to the public
  internet, so authentication on the local machine can be relaxed.
- The dashboard polls the API for updates at a configured interval (default every 5 seconds);
  real-time push (WebSocket) is out of scope for MVP.
- The dashboard is a single-page application served as static files; it communicates with the
  API only via HTTP calls.
- Touchscreen compatibility targets the specific laptop's screen size; mobile phone compatibility
  is out of scope.
- The dashboard is the admin interface; the Telegram bot is the primary operator interaction for
  queries and alerts.
