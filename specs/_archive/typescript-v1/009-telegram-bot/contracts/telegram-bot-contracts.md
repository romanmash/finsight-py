# Telegram Bot Contracts (009)

## 1) Command Routing Contract (Explicit Preservation)

All supported commands must map to deterministic backend actions.

| Command | Input Contract | Preserved API Call (from manual spec) | Output Contract |
|---|---|---|---|
| `/help` | no args | static (no API call) | command catalog text |
| `/brief` | no args | `GET /api/briefs/latest` | formatted daily brief |
| `/pattern TICKER Nw` | ticker + period token | `POST /api/chat { message: '/pattern ...' }` | technical analysis |
| `/compare T1 T2` | exactly two tickers | `POST /api/chat { message: '/compare ...' }` | comparison output |
| `/devil TICKER` | one ticker | `POST /api/chat { message: '/devil ...' }` | devil's-advocate output |
| `/thesis TICKER` | one ticker | `GET /api/kb/thesis/:ticker` | current thesis |
| `/history TICKER` | one ticker | `GET /api/kb/history/:ticker` | snapshot list |
| `/screener show last` | fixed phrase | Bot compatibility mapping to `GET /api/screener/summary` | latest screener results |
| `/trade TICKER buy\|sell QTY` | ticker + action + positive qty | `POST /api/chat { message: '/trade ...' }` | ticket creation confirmation |
| `/approve TICKET_ID` | ticket id | `POST /api/tickets/:id/approve` | approval confirmation |
| `/reject TICKET_ID` | ticket id (+ optional reason) | `POST /api/tickets/:id/reject` | rejection confirmation |
| `/alert` | no args | `GET /api/alerts` | pending alerts |
| `/ack ALERT_ID` | alert id | `POST /api/alerts/:id/ack` | acknowledgment |
| `/watchlist` | no args | `GET /api/watchlist` | watchlist summary |
| `/add TICKER type` | ticker + list type | `POST /api/watchlist` | add confirmation |
| `/portfolio` | no args | `GET /api/portfolio` | holdings summary |
| free-text | plain message | `POST /api/chat { message }` | operator-query response |

### Compatibility note

- The manual draft used `/api/screener/last`.
- Current 008 implementation exposes `/api/screener/summary`.
- 009 implementation MUST preserve `/screener show last` UX phrase while routing deterministically to `/api/screener/summary` in bot command mapping.

## 2) Access Control Contract

- Incoming Telegram messages are processed only when sender identity maps to an active user.`r`n- Minimal sender attributes required for processing: `from.id`, `chat.id`, and identity key (`from.username` or mapped equivalent).`r`n- Missing required sender attributes returns deterministic `validation_error` and no downstream action.
- Unauthorized/inactive identities receive denial response and no downstream action.
- First successful contact stores chat destination for future proactive messages.
- Preserved denial message semantic: `⛔ Access denied.`

## 3) Throttle Contract

- Enforce configurable per-user request limits.
- Exceeded limit returns deterministic throttle response.
- Window expiry restores eligibility.
- Preserved throttle message semantic: `⏱ Rate limit exceeded. Please wait.`

## 4) Formatting Contract

- Every mission-like response must include mission/category label.
- Messages exceeding Telegram size constraints are split into ordered chunks at readable boundaries.
- Chunking must preserve readability and semantic continuity.

## 5) Proactive Push Contract

- Internal workflows can request `pushToUser(userId, message)`.
- Delivery uses stored chat destination on user profile.
- Missing destination results in safe skip with warning log.
- Push failures are logged and surfaced to operations telemetry.
- Preserved delivery mechanics: resolve user `telegramChatId`, send with bot transport.

## 6) Error Handling Contract

- Invalid command arguments return usage guidance.
- Upstream service unavailability returns temporary-unavailable user-safe response.
- Bot credential/configuration failures are startup-blocking with explicit error logs.
- Graceful shutdown prevents abrupt in-flight interaction loss.`r`n`r`n### Deterministic response classes`r`n`r`n- `success``r`n- `validation_error``r`n- `unauthorized``r`n- `throttled``r`n- `temporarily_unavailable``r`n- `internal_failure`
## 7) Internal Push Bridge Contract (`telegram-internal`)

When proactive delivery is routed via API-to-bot bridge, the contract is:

- **Endpoint**: `POST /api/telegram-internal/push`
- **Authentication**: service-to-service shared secret via `X-Internal-Token` header, validated against `TELEGRAM_INTERNAL_TOKEN` from `.env` (no public/user JWT usage).
- **Payload**:
  - `userId` (required)
  - `message` (required)
  - `sourceType` (required: `alert|daily_brief|system`)
  - `missionId` (optional, for traceability)
- **Success response**:
  - `delivered: true|false`
  - `reason: sent|skipped_no_chat|send_failed`
- **Failure semantics**:
  - Validation failures return deterministic 4xx envelope.
  - Auth failures return deterministic 401/403 envelope.
  - Transport/runtime failures return deterministic 5xx envelope.
- **Idempotency expectation**:
  - Duplicate delivery attempts for same event should be safely handled by caller retry policy and logged with correlation metadata.`r`n  - Receiver side should enforce duplicate suppression when an idempotency/correlation key is provided.
