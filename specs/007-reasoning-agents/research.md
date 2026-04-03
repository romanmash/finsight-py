# Research: Reasoning Agents (007)

## LLM Invocation Pattern for Stateless Reasoning Agents

**Chosen**: Direct `langchain_openai.ChatOpenAI` (or compatible OpenAI-compatible endpoint) with structured output via `model.with_structured_output(PydanticModel)`
**Rationale**: Agents 007 reason only from their input payload — no tool calls, no retrieval. `with_structured_output` binds the LLM call directly to a Pydantic v2 model, giving us typed output with zero extra parsing code. This is simpler than a full LangGraph graph for single-step agents.
**Alternatives considered**: LangGraph `StateGraph` per agent (overkill for single-step reasoning), plain `json.loads` on raw LLM output (fragile), Instructor library (additional dep not needed).

## Prompt Colocation Strategy

**Chosen**: `x_agent.prompt.py` sibling file next to `x_agent.py`, exposing module-level `SYSTEM_PROMPT: str` and `build_user_prompt(input: InputModel) -> str`
**Rationale**: Keeps prompts close to the code that uses them, easy to find, avoids a separate prompts package. Matches the AGENTS.md requirement.
**Alternatives considered**: Jinja2 templates in `config/prompts/` (adds dep, harder to typecheck), inline strings (makes agent files unwieldy).

## Assessment Pydantic Model Design

**Chosen**: `packages/shared/src/finsight/shared/models/assessment.py` with `ThesisImpact` enum (`SUPPORTS`, `CONTRADICTS`, `NEUTRAL`) and `Assessment` Pydantic v2 BaseModel
**Rationale**: Thesis impact must be a closed set to enable programmatic downstream processing (e.g., alert logic). Pydantic v2 enums serialize cleanly to JSON. Placing in `packages/shared` lets all consumers (API, dashboard, telegram-bot) import without circular deps.
**Alternatives considered**: Free-text `impact` field (untyped, untestable), separate schema file (redundant).

## PatternReport — No-Advice Constraint Enforcement

**Chosen**: Prompt-level instruction + schema-level validation: `PatternReport` has no `recommendation`, `price_target`, or `action` fields; system prompt explicitly forbids advice; tests assert forbidden field absence
**Rationale**: Belt-and-suspenders — the schema cannot represent advice even if the LLM tries to include it, and the prompt reduces the probability of hallucinated advice appearing in observation text.
**Alternatives considered**: Post-processing filter (fragile, could miss nuanced phrasing), separate validator agent (adds latency, complexity).

## Bookkeeper Deduplication Strategy

**Chosen**: SHA-256 content hash of `(ticker, entry_type, content_summary)` stored in `KnowledgeEntry.content_hash` (indexed, unique per ticker+type). On write, attempt INSERT; on unique constraint violation, UPDATE the existing row and append provenance to `provenance_history: list[ProvenanceRecord]`
**Rationale**: Hash-based dedup is O(1) at lookup time and database-enforced — no race conditions. Provenance history preserves the audit trail required by FR-006.
**Alternatives considered**: Semantic similarity check via pgvector cosine distance (non-deterministic, expensive, overkill for deduplication), timestamp-only dedup (misses true duplicates from different pipelines).

## KnowledgeEntry Storage Backend

**Chosen**: SQLAlchemy 2.x async ORM on PostgreSQL 16 + pgvector extension. `KnowledgeEntry` is a full ORM model with a `pgvector` column (`embedding: Vector(1536)`) for future semantic retrieval (Feature 004 compatibility). The Bookkeeper writes via the async session from `apps/api/src/api/lib/db.py`.
**Rationale**: Consistent with Feature 002 data layer. pgvector column is additive — populated by a separate embedding step (Feature 004) and nullable in 007.
**Alternatives considered**: Redis for fast K/V store (no SQL query support, no vector), separate SQLite for KB (splits infra).

## AgentRun Cost Tracking

**Chosen**: `AgentRun` ORM model (Feature 005) captured via a `record_agent_run` helper that wraps every LLM call. The helper captures `tokens_in`, `tokens_out`, `cost_usd` (via `pricing.yaml` lookup), `provider`, `model`, `duration_ms` from LLM response metadata.
**Rationale**: Constitution requirement. Centralised helper avoids duplicating cost logic across 4 agents.
**Alternatives considered**: LangSmith callbacks only (not stored in our DB, no offline fallback), manual per-agent tracking (error-prone, inconsistent).

## Offline Test Strategy

**Chosen**: `pytest` + `respx` for HTTP mocking + `unittest.mock.AsyncMock` for LLM client. Each agent test passes a synthetic input model, patches `ChatOpenAI.ainvoke`, and asserts on the returned Pydantic model fields. Bookkeeper tests use `pytest-asyncio` with an in-memory SQLite async engine swapped in via a fixture.
**Rationale**: Matches project constraint (no network, no Docker in tests). SQLite supports SQLAlchemy 2.x async via `aiosqlite`.
**Alternatives considered**: `pytest-recording` / VCR cassettes (fragile for LLM calls), real DB in test (requires Docker).
