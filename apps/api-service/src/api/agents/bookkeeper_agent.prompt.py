"""BookkeeperAgent — Sole Knowledge Base Writer.

No LLM call. All logic is deterministic:
- content_hash = SHA-256(ticker + entry_type + content_summary)
- Upsert by content_hash, with ticker+entry_type fallback dedupe
- Conflict detection on high-confidence divergent summaries
- Never deletes; inserts or updates only
"""
