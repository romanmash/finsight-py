# Feature Specification: Telegram Bot Experience

**Feature Branch**: `009-telegram-bot`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "Manual draft for Telegram bot feature; canonicalize and preserve important implementation decisions"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Access via Telegram Identity (Priority: P1)

As a registered user, I want only authorized Telegram accounts to interact with the assistant so that platform actions and analysis requests are protected from unauthorized use.

**Why this priority**: Unauthorized access can trigger costly operations and expose sensitive workflow data.

**Independent Test**: Send messages from unregistered, inactive, and active accounts and verify access outcomes without requiring other stories.

**Acceptance Scenarios**:

1. **Given** a Telegram sender identity that is not mapped to an active user, **When** the sender submits any command, **Then** the system denies access with a clear rejection message and does not execute the request.
2. **Given** a Telegram sender identity mapped to an active user, **When** the sender submits a command, **Then** the system processes the request.
3. **Given** an active user contacts the bot for the first time from a chat, **When** the message is received, **Then** the system records the chat destination needed for future proactive notifications.

---

### User Story 2 - Command-Driven Mission Operations (Priority: P1)

As a Telegram user, I want command-based interaction for analysis, watchlist, alerts, portfolio, and ticket actions so that I can complete key workflows from Telegram.

**Why this priority**: Telegram is the primary end-user interface; command handling is the core product surface.

**Independent Test**: Execute each supported command once and verify the expected business action and user-facing response type.

**Acceptance Scenarios**:

1. **Given** a user issues `/help`, **When** the bot responds, **Then** all supported commands are shown with concise usage guidance.
2. **Given** a user issues an analysis command (`/brief`, `/pattern`, `/compare`, `/devil`, `/thesis`, `/history`), **When** the request is handled, **Then** the corresponding analysis or knowledge output is returned in human-readable form.
3. **Given** a user issues action commands (`/trade`, `/approve`, `/reject`, `/alert`, `/ack`, `/watchlist`, `/add`, `/portfolio`), **When** the request is handled, **Then** the user receives clear confirmation or error feedback.
4. **Given** a user sends free text that is not a command, **When** the bot handles it, **Then** the message is processed as a general operator query.

---

### User Story 3 - Fair Usage Through Rate Limits (Priority: P1)

As a platform operator, I want per-user Telegram request throttling so that a single user cannot exhaust shared capacity or budget.

**Why this priority**: Throughput and cost control are required for reliable multi-user service.

**Independent Test**: Submit requests above the configured user limit within one time window and verify throttling behavior and recovery after cooldown.

**Acceptance Scenarios**:

1. **Given** a user exceeds the configured request limit within the active time window, **When** another request is submitted, **Then** the bot returns a throttle response and does not execute the request.
2. **Given** a throttled user waits until the window resets, **When** a new request is sent, **Then** requests are accepted again.
3. **Given** the bot process restarts, **When** rate-limit state is checked, **Then** enforcement behavior remains consistent with configured persistence expectations.

---

### User Story 4 - Readable and Consistent Message Formatting (Priority: P1)

As a Telegram user, I want responses to be clearly labeled and formatted so that I can quickly interpret output type and actionability.

**Why this priority**: Response clarity directly affects decision speed and trust.

**Independent Test**: Validate formatting outputs across mission categories and long responses without relying on proactive notifications.

**Acceptance Scenarios**:

1. **Given** a mission response is produced, **When** the formatter runs, **Then** the message includes the correct mission label and readable structure.
2. **Given** a response exceeds Telegram maximum message length, **When** delivery occurs, **Then** the output is chunked into ordered, readable parts without truncating semantic content.
3. **Given** historical thesis output is requested, **When** formatting completes, **Then** each history item includes timestamp and change context.

---

### User Story 5 - Proactive Notification Delivery (Priority: P1)

As a Telegram user, I want important alerts and scheduled updates delivered proactively so that I receive critical intelligence without manually polling.

**Why this priority**: Proactive delivery is a key differentiator and core user promise.

**Independent Test**: Trigger an alert and a scheduled brief for a user with known chat destination and verify both are delivered successfully.

**Acceptance Scenarios**:

1. **Given** a system alert event is generated for a user, **When** notification delivery is triggered, **Then** the user receives a push message in their mapped Telegram chat.
2. **Given** a scheduled brief event is generated, **When** delivery runs, **Then** each eligible user receives their brief proactively.
3. **Given** a user has no stored chat destination, **When** proactive delivery is attempted, **Then** the attempt is skipped safely and logged for observability.

### Edge Cases

- Invalid or expired bot credentials at startup.
- Commands with missing or malformed arguments.
- Commands with unsupported argument variants or unknown aliases.
- Temporary upstream service unavailability during command handling.
- Telegram transport failures during send operations.
- Burst traffic from one user while others continue normal operation.
- Duplicate notifications for the same event window.
- User profile changes (deactivation or handle change) between command issue and execution.
- Sender metadata missing one or more expected Telegram attributes.
- Recovery after transient upstream or transport outage once dependency health is restored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST enforce authorization for all inbound Telegram messages (commands and free-text) by resolving sender identity to an active internal user before any downstream action.
- **FR-002**: The system MUST persist a user chat destination on first successful contact, where first successful contact means the first authorized inbound message from a mapped active user that reaches handled outcome `success`.
- **FR-003**: The system MUST support the following user commands with defined behavior: `/help`, `/brief`, `/pattern`, `/compare`, `/devil`, `/thesis`, `/history`, `/screener show last`, `/trade`, `/approve`, `/reject`, `/alert`, `/ack`, `/watchlist`, `/add`, `/portfolio`.
- **FR-004**: The system MUST treat non-command free-text input as a general operator query.
- **FR-005**: The system MUST enforce configurable per-user rate limits backed by shared persistent runtime state so policy remains consistent across process restarts and multi-instance operation.
- **FR-006**: The system MUST provide human-readable response formatting with mission-type labeling, where readable means the first line contains a mission label and message body preserves list/newline structure.
- **FR-007**: The system MUST split over-length responses into ordered chunks that preserve readability.
- **FR-008**: The system MUST support proactive delivery of alert-driven and scheduled brief notifications for users that are active and have known chat destinations.
- **FR-009**: The system MUST provide deterministic user feedback for successful and failed command execution, with fixed response classes: `success`, `validation_error`, `unauthorized`, `throttled`, `temporarily_unavailable`, `internal_failure`.
- **FR-010**: The system MUST provide graceful shutdown behavior that stops accepting new updates and allows in-flight handlers to finish within a configurable grace period before process exit.
- **FR-011**: The system MUST log denied access, throttling, delivery failures, and skipped proactive notifications with minimum context fields `eventType`, `userId?`, `telegramHandle?`, `chatId?`, `command?`, `reasonCode`, and `correlationId`.
- **FR-012**: The system MUST allow operational configuration of bot behavior (including rate-limit policy and command behavior toggles) without source-code changes.
- **FR-013**: The system MUST preserve manual response semantics for critical guardrails: unauthorized access returns `⛔ Access denied.` and throttle events return `⏱ Rate limit exceeded. Please wait.`.
- **FR-014**: The system MUST require minimal sender attributes `from.id`, `chat.id`, and either `from.username` or an equivalent mapped identity token; requests missing required sender attributes MUST return deterministic `validation_error` handling and no downstream action.
- **FR-015**: The system MUST fail startup for invalid/expired bot credentials, invalid runtime configuration, or unavailable mandatory dependencies required for safe command processing.
- **FR-016**: The system MUST enforce command argument contracts and return deterministic usage guidance when argument shape/cardinality is invalid.
- **FR-017**: The system MUST enforce duplicate-notification protection for proactive delivery attempts by honoring event correlation/idempotency keys from upstream workflows.
- **FR-018**: The system MUST meet interactive responsiveness target p95 <= 3 seconds for authorization + throttle decision + initial user-visible acknowledgment under controlled load.
- **FR-019**: The system MUST protect Telegram identity and chat-destination data by excluding raw secrets from logs and avoiding storage of unnecessary personal metadata.

### Command Argument Contract

The following argument rules are normative and must be validated before downstream dispatch:

| Command | Argument Rule | Invalid-Argument Outcome |
|---|---|---|
| `/help` | no args | `validation_error` + usage |
| `/brief` | no args | `validation_error` + usage |
| `/pattern TICKER Nw` | exactly 2 args (`TICKER`, period token like `2w`) | `validation_error` + usage |
| `/compare T1 T2` | exactly 2 ticker args | `validation_error` + usage |
| `/devil TICKER` | exactly 1 ticker arg | `validation_error` + usage |
| `/thesis TICKER` | exactly 1 ticker arg | `validation_error` + usage |
| `/history TICKER` | exactly 1 ticker arg | `validation_error` + usage |
| `/screener show last` | exact phrase (no alias) | `validation_error` + usage |
| `/trade TICKER buy|sell QTY` | exactly 3 args; `QTY` positive numeric | `validation_error` + usage |
| `/approve TICKET_ID` | exactly 1 ticket id | `validation_error` + usage |
| `/reject TICKET_ID [reason]` | at least 1 arg (`reason` optional tail text) | `validation_error` + usage |
| `/alert` | no args | `validation_error` + usage |
| `/ack ALERT_ID` | exactly 1 alert id | `validation_error` + usage |
| `/watchlist` | no args | `validation_error` + usage |
| `/add TICKER type` | exactly 2 args | `validation_error` + usage |
| `/portfolio` | no args | `validation_error` + usage |

### Key Entities *(include if feature involves data)*

- **Telegram User Identity Link**: Mapping between Telegram sender identity and internal user account, including active status and mapped chat destination.
- **Command Request**: A parsed user instruction containing command intent, arguments, issuing user context, and execution outcome.
- **Rate Limit State**: Per-user usage counters and window metadata used to determine whether requests are allowed.
- **Formatted Bot Message**: User-facing response payload including mission label, body content, and optional chunk index metadata.
- **Proactive Notification Job**: Delivery request generated by internal events (alerts/briefs) targeting one or more users.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of requests from unauthorized or inactive Telegram identities are rejected without executing protected actions.
- **SC-002**: 100% of supported commands return either a successful result or a deterministic user-facing error within one interaction cycle.
- **SC-003**: In throttling tests, requests above configured per-user limits are blocked with correct throttle messaging, and normal service resumes after window reset.
- **SC-004**: 100% of responses that exceed Telegram size limits are delivered as ordered chunks with no semantic truncation.
- **SC-005**: At least 99% of proactive notifications for users with valid chat destinations are delivered successfully in controlled test runs.
- **SC-006**: 100% of proactive delivery attempts for users without chat destination are skipped safely and logged.
- **SC-007**: In command-path validation, unauthorized access and throttling responses match preserved guardrail semantics exactly.
- **SC-008**: In controlled load tests, p95 latency for authorization + throttling decision + first acknowledgment remains <= 3 seconds.
- **SC-009**: 100% of denial/throttle/push-failure log events include required observability context fields from FR-011.
- **SC-010**: 100% of malformed command and missing-sender-attribute cases return deterministic `validation_error` feedback without downstream execution.

## Assumptions

- The feature depends on completed 008 orchestration contracts, including `/api/chat`, `/api/briefs/latest`, `/api/screener/summary`, watchlist/portfolio/ticket routes, and API auth behavior.
- End users interact through Telegram as their primary interface, while admin dashboard flows remain out of scope for this feature.
- Command-to-backend action mappings and strict argument semantics are preserved from the original manual draft and documented in `decisions.md` for planning continuity.
- Detailed implementation choices (framework, transport mode, route-level integration specifics) are intentionally deferred to planning and implementation artifacts.
- Optional argument handling is limited to documented contracts in this spec; undocumented aliases or shorthand are out of scope for 009.

## Out of Scope

- Admin dashboard UX, admin moderation tooling, and dashboard-driven Telegram control flows.
- In-chat account onboarding, self-registration, or credential bootstrap.
- Webhook-mode bot delivery and ingress/TLS infrastructure changes.

## Preserved Implementation Details

To avoid losing critical operational details from the original manual draft, the following artifacts are normative inputs for planning/implementation:

- [decisions.md](./decisions.md) - explicit preserved decisions, exact message semantics, and command intent mapping.
- [contracts/telegram-bot-contracts.md](./contracts/telegram-bot-contracts.md) - explicit command -> API mapping (including `/screener show last` compatibility note).
- [manual-spec-original.md](./manual-spec-original.md) - immutable snapshot of the original manual `spec.md` before canonical rewrite.

These preserved details MUST be reflected in `plan.md`, `tasks.md`, and implementation unless a documented rationale approves deviation.
