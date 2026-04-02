# Telegram Bot Implementation Decisions (Preserved from Original Draft)

This file captures important implementation-level decisions from the original manual `spec.md` so they are not lost during canonical specification cleanup. These points are **planning inputs** and must be validated in `/speckit-plan` and implemented through `/speckit-tasks`.

## Source of Truth Preservation

- Canonical stakeholder spec: [spec.md](./spec.md)
- Original manual authoring snapshot: [manual-spec-original.md](./manual-spec-original.md)
- Contract-normalized implementation mapping: [contracts/telegram-bot-contracts.md](./contracts/telegram-bot-contracts.md)

## Preserved Decisions

1. **Bot operation mode**: Use Telegram polling mode (no webhook deployment dependency) unless a later plan explicitly changes it with rationale.
2. **Identity model**: Authenticate by Telegram handle mapping to existing user records; reject unknown/inactive users before any expensive work.
3. **Chat destination persistence**: Store `telegramChatId` on first successful user interaction for future proactive pushes.
4. **Command set**: Preserve explicit 16-command UX contract from original draft:
   - `/help`, `/brief`, `/pattern`, `/compare`, `/devil`, `/thesis`, `/history`, `/screener show last`, `/trade`, `/approve`, `/reject`, `/alert`, `/ack`, `/watchlist`, `/add`, `/portfolio`
5. **Free-text behavior**: Non-command messages route as operator-query interactions.
6. **Rate limiting model**: Per-user throttling with persistent state across bot restarts and configurable policy in runtime config (`telegram.yaml`).
7. **Formatting policy**: Apply mission-type labels and enforce Telegram max message length chunking at readable boundaries.
8. **Proactive pushes**: Support push delivery for alert and daily-brief flows using stored chat destination.
9. **Missing chat destination behavior**: Skip push safely and emit warning logs.
10. **Startup and runtime reliability**:
    - Invalid bot credentials fail startup clearly.
    - Upstream service outages return temporary-unavailable style user feedback.
    - Controlled shutdown handles in-flight work gracefully.

## Preserved Runtime Message Semantics (Explicit)

- Access denied response text: `⛔ Access denied.`
- Throttle response text: `⏱ Rate limit exceeded. Please wait.`
- Upstream failure response text intent: `⚠️ Service temporarily unavailable` (exact punctuation may be normalized in formatter policy, but semantic equivalence is required).
- Implementation policy: these semantics are configuration-driven values (no source hardcoding), with defaults set in runtime config and validated at startup.

## Preserved Command-to-API Intent Mapping (Manual Draft)

| Command | Preserved Intent |
|---|---|
| `/brief` | Retrieve latest brief and format response |
| `/pattern TICKER Nw` | Route through chat mission as pattern request |
| `/compare T1 T2` | Route through chat mission as comparison |
| `/devil TICKER` | Route through chat mission as devil advocate |
| `/thesis TICKER` | Retrieve current thesis |
| `/history TICKER` | Retrieve thesis history snapshots |
| `/screener show last` | Retrieve latest screener summary |
| `/trade TICKER buy\|sell QTY` | Route through chat mission for ticket creation |
| `/approve TICKET_ID` | Approve trade ticket |
| `/reject TICKET_ID` | Reject trade ticket |
| `/alert` | List pending alerts |
| `/ack ALERT_ID` | Acknowledge alert |
| `/watchlist` | Show watchlist |
| `/add TICKER type` | Add watchlist item |
| `/portfolio` | Show holdings |
| `/help` | Show command catalog |

## Handoff Guidance

- Keep this file as source material during `/speckit-plan`, `/speckit-tasks`, and `/speckit-implement`.
- If any preserved decision is changed, document rationale explicitly in `plan.md` and relevant contract/task artifacts.
- Do not delete `manual-spec-original.md`; it is a continuity anchor for future reviews.
- Restart-resilient throttling must stay offline-testable by abstracting rate-limit state access behind a mockable adapter/test double.
