# Feature Specification: Telegram Bot & Voice

**Feature Branch**: `009-telegram-bot-voice`
**Created**: 2026-04-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Operator Sends a Text Question via Telegram and Receives an Answer (Priority: P1)

The operator opens Telegram and types a question about a watched asset. The bot receives the
message, authenticates the operator's Telegram identity against the registered operator list,
creates a mission, and waits for the orchestration pipeline to complete. When the result is
ready, the bot delivers the formatted response back to the operator in the same chat.

**Why this priority**: Telegram is the primary human interface. Without it, the operator has no
conversational access to the agent team.

**Independent Test**: Send a text query from a registered operator's Telegram account, verify a
mission is created, mock the pipeline response, verify the formatted answer is delivered to the
correct chat.

**Acceptance Scenarios**:

1. **Given** a registered operator sends a text message to the bot, **When** the message is
   received, **Then** a mission is created and the operator receives an acknowledgement that the
   request is being processed.
2. **Given** a mission completes, **When** the result is available, **Then** the formatted
   response is delivered to the operator's chat without requiring further operator action.
3. **Given** an unregistered Telegram user sends a message, **When** the bot receives it, **Then**
   the user receives an access denied response and no mission is created.

---

### User Story 2 — Operator Sends a Voice Message and It Is Understood as a Query (Priority: P1)

The operator records a voice note on their phone and sends it to the bot instead of typing.
The bot downloads the audio, transcribes it to text, and processes the transcription as if it
were a typed text query. The operator receives the same quality of response they would get from
a text message.

**Why this priority**: Voice is a real interface requirement. The operator may be away from a
keyboard or prefer speaking. This was explicitly requested as a first-class interaction mode.

**Independent Test**: Send a voice message file to the bot's update handler, verify the audio is
transcribed, verify the transcription is used to create a mission, verify a response is returned.

**Acceptance Scenarios**:

1. **Given** a registered operator sends a voice message, **When** the bot receives it, **Then**
   the audio is transcribed and the text is used as the mission input.
2. **Given** a voice message with unclear audio, **When** transcription produces low-confidence
   output, **Then** the bot asks the operator to clarify rather than proceeding with a
   low-quality transcription.
3. **Given** a voice message in any language, **When** transcribed, **Then** the transcription
   preserves the operator's intended meaning as accurately as technically feasible.

---

### User Story 3 — Operator Uses Bot Commands to Manage Watchlist and Missions (Priority: P2)

The operator uses slash commands to interact with the system directly: checking the current
watchlist, viewing active missions, acknowledging alerts, and requesting the latest brief. Each
command is authenticated, produces an immediate response, and does not require the operator to
leave the Telegram interface.

**Why this priority**: Slash commands give the operator structured control without typing free-form
questions. They are the operational interface layer above conversational queries.

**Independent Test**: Call each supported slash command from a registered operator account, verify
each returns the expected structured response, call commands from an unregistered user and verify
they are rejected.

**Acceptance Scenarios**:

1. **Given** a registered operator sends `/watchlist`, **When** the bot receives it, **Then** it
   returns a formatted list of all active watchlist items with their current status.
2. **Given** a registered operator sends `/missions`, **When** the bot receives it, **Then** it
   returns a list of recent missions with their status (active, complete, failed).
3. **Given** an admin operator sends `/alert acknowledge [id]`, **When** the bot receives it,
   **Then** the specified alert is marked acknowledged and a confirmation is returned.

---

### User Story 4 — Bot Delivers Proactive Alerts Without Operator Prompting (Priority: P1)

When the orchestration system completes an alert-triggered mission, the bot delivers the formatted
investigation result to the operator proactively — they do not need to ask. The delivery happens
as soon as the result is available, not on a fixed polling schedule.

**Why this priority**: Proactive delivery is the primary mechanism for the always-on monitoring
promise. Without push delivery, the operator must poll for results.

**Independent Test**: Complete an alert-triggered mission programmatically, verify the bot
delivers the result to the configured operator chat without any operator-initiated message.

**Acceptance Scenarios**:

1. **Given** an alert-triggered mission completes, **When** the result is available, **Then** the
   bot delivers the formatted result to the operator's primary Telegram chat.
2. **Given** multiple missions complete in rapid succession, **When** deliveries are sent, **Then**
   each result is delivered as a separate message without merging or dropping any.

---

### Edge Cases

- What happens when the bot cannot reach the Telegram API (network issue)?
- How does the bot handle very long responses that exceed Telegram message length limits?
- What if a voice message audio file is too large or in an unsupported format?
- What if the transcription service is unavailable when a voice message arrives?
- How are duplicate messages handled (if Telegram re-delivers an update)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The bot MUST authenticate every incoming message against the registered operator
  list using the sender's Telegram identity before processing.
- **FR-002**: The bot MUST accept text messages and create missions from them for registered
  operators.
- **FR-003**: The bot MUST accept voice messages, download the audio, transcribe it to text using
  an external transcription service, and process the transcription as a text query.
- **FR-004**: The bot MUST deliver mission results proactively to the operator's chat when results
  become available, without requiring operator polling.
- **FR-005**: The bot MUST support at minimum the following slash commands: `/watchlist`,
  `/missions`, `/brief`, and `/alert acknowledge [id]`.
- **FR-006**: Unregistered Telegram users MUST receive an access denied response and no system
  action MUST be taken on their behalf.
- **FR-007**: If the transcription service is unavailable, the bot MUST inform the operator and
  request they resend as text rather than silently failing.
- **FR-008**: The bot MUST handle Telegram message length limits by splitting long responses into
  multiple messages rather than truncating content.
- **FR-009**: All bot behaviour MUST be testable offline using mocked Telegram update objects and
  mocked transcription service responses.

### Key Entities

- **TelegramOperator**: A registered operator with a linked Telegram user ID. The bot verifies
  identity against this record on every message.
- **VoiceMessage**: An audio file received from Telegram. Processed by transcription into a text
  string before being treated as a text query.
- **BotCommand**: A slash command supported by the bot. Has a name, description, required role
  (admin or viewer), and a handler.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A text query from a registered operator produces an acknowledgement response within
  3 seconds of receipt.
- **SC-002**: A voice message is transcribed and a mission acknowledgement is delivered within
  10 seconds of the audio being received.
- **SC-003**: A proactive alert delivery reaches the operator's chat within 30 seconds of the
  mission result being available.
- **SC-004**: 100% of messages from unregistered users are rejected without creating any system
  resource or mission, verified by tests.
- **SC-005**: All bot tests pass offline in under 60 seconds without network access.

## Assumptions

- The bot uses long-polling to receive updates from Telegram; webhooks are not required for
  the target deployment environment.
- Voice message transcription uses an external API accessed via HTTPS; the API key is stored
  in `.env`.
- When the transcription service returns a low-confidence result, the confidence threshold for
  requesting clarification is configurable in YAML.
- The bot is a single-user personal tool; there is no concern about concurrent message storms
  from many users simultaneously.
- The bot's Telegram token and the operator's Telegram user IDs are stored in `.env` and in the
  operators database respectively.
