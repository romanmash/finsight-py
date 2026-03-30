# Feature Specification: Telegram Bot

**Feature**: `009-telegram-bot`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)
**Depends on**: `008-orchestration`

## Overview

Implement the Telegram bot container using Telegraf (polling mode). The bot handles all 16 user commands, authenticates users by matching Telegram handles against the database, enforces rate limiting, formats responses with the label system, and supports proactive push notifications from Reporter and Watchdog.

**Why this feature exists:** Telegram is the primary user interface for end-users (operators and analysts). All missions are initiated via Telegram commands, all results are delivered to Telegram, and all trade approvals happen through Telegram. The admin dashboard is secondary — Telegram is where the user lives.

---

## User Scenarios & Testing

### User Story 1 — User Authentication & Access Control (Priority: P1)

As the system, I want Telegram users authenticated by their handle so that only registered users can interact with the platform.

**Why P1**: Without auth, anyone who finds the bot could trigger expensive API calls. Security is non-negotiable.

**Independent Test**: Send a message from an unknown Telegram handle, verify the bot responds with "⛔ Access denied." and does no further processing.

**Acceptance Scenarios**:

1. **Given** a message from an unknown Telegram handle, **When** the handler processes it, **Then** it replies "⛔ Access denied." and stops
2. **Given** a message from a known handle but `active: false`, **When** the handler processes it, **Then** it replies "⛔ Access denied."
3. **Given** a message from a known, active user, **When** the handler processes it, **Then** it looks up the user and proceeds with the command
4. **Given** a user's first-ever message, **When** the handler processes it, **Then** it stores the `telegramChatId` from the message context on the User record (needed for proactive push)

---

### User Story 2 — Command Processing (Priority: P1)

As a Telegram user, I want to issue commands and receive formatted responses so that I can get market intelligence without leaving Telegram.

**Why P1**: This is the primary UX. Every demo interaction happens through these commands.

**Independent Test**: Send `/pattern NVDA 3w` to the bot, verify the correct API endpoint is called and a formatted response is delivered.

**Acceptance Scenarios**:

1. **Given** `/help`, **Then** bot replies with all 16 commands and descriptions
2. **Given** `/brief`, **Then** bot calls `GET /api/briefs/latest` and formats the response
3. **Given** `/pattern NVDA 3w`, **Then** bot calls `POST /api/chat { message: '/pattern NVDA 3w' }` and delivers Technician output
4. **Given** `/compare NVDA AMD`, **Then** bot calls `POST /api/chat { message: '/compare NVDA AMD' }` and delivers comparison table
5. **Given** `/devil NVDA`, **Then** bot calls `POST /api/chat { message: '/devil NVDA' }` and delivers devil's advocate analysis
6. **Given** `/thesis NVDA`, **Then** bot calls `GET /api/kb/thesis/NVDA` and delivers current thesis
7. **Given** `/history NVDA`, **Then** bot calls `GET /api/kb/history/NVDA` and delivers formatted snapshot list
8. **Given** `/trade NVDA buy 10`, **Then** bot calls `POST /api/chat { message: '/trade NVDA buy 10' }` and delivers ticket creation confirmation
9. **Given** `/approve TICKET_ID`, **Then** bot calls `POST /api/tickets/:id/approve` and confirms execution
10. **Given** `/reject TICKET_ID`, **Then** bot calls `POST /api/tickets/:id/reject` and confirms rejection
11. **Given** any free-text message (not a command), **Then** bot calls `POST /api/chat { message }` as an operator query

---

### User Story 3 — Rate Limiting (Priority: P1)

As the system, I want per-user rate limiting so that no single user can overwhelm the platform with requests.

**Why P1**: LLM calls are expensive. An unthrottled user could burn through the daily budget in minutes.

**Independent Test**: Send requests exceeding the rate limit, verify the bot responds with "⏱ Rate limit exceeded. Please wait."

**Acceptance Scenarios**:

1. **Given** rate limit is 5 requests per minute, **When** user sends request #6, **Then** bot replies "⏱ Rate limit exceeded. Please wait."
2. **Given** user was rate-limited, **When** 60 seconds pass, **Then** user can send requests again
3. **Rate limit is Redis-backed** — survives bot restarts

---

### User Story 4 — Message Formatting (Priority: P1)

As a Telegram user, I want nicely formatted responses with mission-type labels so that I can quickly understand what type of analysis I'm seeing.

**Why P1**: Raw JSON is useless. The label system and formatting make the output professional.

**Independent Test**: Verify the formatter applies correct labels and handles messages over 4096 characters.

**Acceptance Scenarios**:

1. **Given** an operator_query response, **When** formatter runs, **Then** the message is prefixed with the appropriate label (📊, 🔍, ⚔️, etc.)
2. **Given** a message exceeding 4096 characters, **When** formatter runs, **Then** it splits into multiple messages at word boundaries
3. **Given** a `/history` response with 4 snapshots, **When** formatter runs, **Then** each snapshot shows date, confidence, change type, and summary

---

### User Story 5 — Proactive Push Notifications (Priority: P1)

As a Telegram user, I want to receive alerts and daily briefs without issuing a command so that I'm notified of important market events automatically.

**Why P1**: Proactive intelligence (alerts, daily brief) is a key differentiator. The system doesn't just respond — it reaches out.

**Independent Test**: Trigger a Watchdog alert for a user, verify a push message arrives in their Telegram chat.

**Acceptance Scenarios**:

1. **Given** Watchdog creates a `price_spike` alert for a user, **When** Reporter delivers it, **Then** `pushToUser(userId, message)` sends the alert to the user's Telegram chat
2. **Given** daily brief worker runs at 06:00, **When** Reporter delivers it, **Then** each active user receives their brief as a push message
3. **Given** `pushToUser` is called, **Then** it looks up `user.telegramChatId` from the database and calls `bot.telegram.sendMessage(chatId, message)`
4. **Given** `telegramChatId` is null (user never messaged the bot), **Then** push fails silently with a warning log

---

### Edge Cases

- What if the bot token is invalid? → Bot fails to start, process exits with clear error
- What if a command has wrong arguments (e.g., `/pattern NVDA`)? → Bot replies with usage hint
- What if the API is unreachable from the bot container? → Bot replies "⚠️ Service temporarily unavailable" and logs the error
- What if multiple messages arrive simultaneously? → Telegraf handles them sequentially (polling mode)

---

## Requirements

### Functional Requirements

- **FR-001**: MUST use Telegraf polling mode (no webhooks required)
- **FR-002**: MUST authenticate users by matching `ctx.from.username` against `User.telegramHandle`
- **FR-003**: MUST store `telegramChatId` on first contact from a user
- **FR-004**: MUST implement all 16 commands with correct API mapping (see table below)
- **FR-005**: MUST implement Redis-backed rate limiting with configurable limit from `telegram.yaml`
- **FR-006**: MUST implement `pushToUser(userId, message)` for proactive delivery
- **FR-007**: MUST split messages exceeding 4096 characters at word boundaries
- **FR-008**: MUST apply output labels based on mission type
- **FR-009**: MUST implement graceful shutdown on SIGTERM
- **FR-010**: Free-text messages (non-commands) MUST be treated as `operator_query`

### Command → API Mapping

| Command | API Call | Response |
|---|---|---|
| `/brief` | `GET /api/briefs/latest` | Formatted daily brief |
| `/pattern TICKER Nw` | `POST /api/chat` | Technical analysis |
| `/compare T1 T2` | `POST /api/chat` | Comparison table |
| `/devil TICKER` | `POST /api/chat` | Devil's advocate analysis |
| `/thesis TICKER` | `GET /api/kb/thesis/:ticker` | Current thesis |
| `/history TICKER` | `GET /api/kb/history/:ticker` | Thesis snapshots |
| `/screener show last` | `GET /api/screener/last` | Last screener results |
| `/trade TICKER buy\|sell QTY` | `POST /api/chat` | Trade ticket creation |
| `/approve TICKET_ID` | `POST /api/tickets/:id/approve` | Approval confirmation |
| `/reject TICKET_ID` | `POST /api/tickets/:id/reject` | Rejection confirmation |
| `/alert` | `GET /api/alerts` | Pending alerts |
| `/ack ALERT_ID` | `POST /api/alerts/:id/ack` | Acknowledgment |
| `/watchlist` | `GET /api/watchlist` | Current watchlist |
| `/add TICKER type` | `POST /api/watchlist` | Add to watchlist |
| `/portfolio` | `GET /api/portfolio` | Current holdings |
| `/help` | (static) | All commands + descriptions |

---

## Success Criteria

- **SC-001**: Unknown Telegram handle receives "⛔ Access denied."
- **SC-002**: `/help` returns all 16 commands
- **SC-003**: `/pattern NVDA 3w` dispatches Technician and returns formatted TA summary
- **SC-004**: Rate limit returns throttle message after exceeding limit
- **SC-005**: `/history NVDA` after seed returns 4 snapshots including contradiction entry
- **SC-006**: Proactive push delivers alert to correct Telegram chat
