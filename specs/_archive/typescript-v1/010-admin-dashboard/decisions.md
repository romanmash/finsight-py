# Preserved Implementation Decisions: Admin Dashboard (010)

## Purpose

This file preserves high-value implementation details from the original manual dashboard draft so canonical specification cleanup does not lose important delivery intent.

## Preserved Decisions

1. **Primary dashboard positioning**: The admin dashboard is a primary demonstration surface and should emphasize real-time multi-agent observability.
2. **Reference-design fidelity**: `docs/dashboard-reference.html` is the canonical visual reference for layout hierarchy, state semantics, and interaction tone.
3. **Near-real-time refresh strategy**: Poll status every 3 seconds; no websocket requirement for 010.
4. **Visibility-aware refresh behavior**: Pause polling when tab is hidden and resume on visibility restoration.
5. **Auth/session security posture**:
   - Access token in memory only.
   - Refresh flow uses secure cookie-based session renewal.
   - Unauthorized responses must clear admin session context.
6. **Agent floor emphasis**: All 9 agent cards are always represented with clear state semantics (idle/queued/active/error) and daily cost context.
7. **Mission-control emphasis**: Active mission panel must show pipeline progression and tool-call activity states in a way operators can interpret quickly.
8. **Operational observability scope**: Health, queue pressure, KB indicators, and spend overview are all first-class dashboard sections.
9. **Admin action scope for 010**:
   - Reload configuration.
   - Trigger screener scan.
   - Trigger watchdog scan.
10. **Mission history visibility**: Recent mission log should remain directly accessible from the dashboard context.

## Detail Mapping Notes

- Exact visual tokens, spacing, and accent behavior from the original draft should be mapped into planning artifacts, not removed.
- Where canonical spec language is intentionally technology-agnostic, this file remains the authoritative bridge for implementation-specific fidelity.

## Source Provenance

- Original source snapshot: [manual-spec-original.md](./manual-spec-original.md)
- Canonicalized specification target: [spec.md](./spec.md)


## Explicit UI/Behavior Fidelity Requirements (Preserved)

The following details from the manual draft are mandatory implementation constraints for 010:

1. **Polling cadence**: 3000ms fixed interval while visible.
2. **Session renewal lead window**: refresh access authorization at 60 seconds before expiry.
3. **Core layout grid**: Mission Control layout uses 4-column shell equivalent to `280px 1fr 200px 180px`.
4. **Agent-card internal grid**: card structure uses 3-zone layout equivalent to `84px 1fr auto`.
5. **Agent-state visual semantics**:
   - `active`: green accent border with light green background (`#f7fffc`)
   - `queued`: amber accent border with light amber background (`#fffdf7`)
   - `idle`: neutral/default treatment
   - `error`: red accent border with light red treatment
6. **Pipeline-state visual semantics**:
   - `done`: solid green node
   - `running`: pulsing ring using green-ring token
   - tool `running`: CSS spinner (top border transparent, ~0.8s rotation)
   - tool `done`: filled green dot
   - tool `pending`: empty grey dot
7. **Health-surface baseline**: dashboard health panel includes 10 service slots:
   - postgres
   - redis
   - 6 MCP services
   - LM Studio
   - telegram-bot
8. **Spend-panel provider baseline**: explicit provider rows include Anthropic, OpenAI, Azure, and LM Studio (zero-cost row allowed when applicable).
9. **Mission-log baseline**: show last 10 completed/failed missions and include LangSmith drill-down link when trace URL is available.
10. **Action set baseline**: dashboard admin tools in 010 include reload config, trigger screener, and trigger watchdog. User management is explicitly deferred out-of-scope for 010.
