# Feature Specification: Reasoning Agents

**Feature**: `007-reasoning-agents`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)
**Depends on**: `005-agent-infrastructure`, `006-collector-agents`

## Overview

Implement the four reasoning/delivery agents: Analyst (thesis synthesis with standard, devil's advocate, and comparison modes), Bookkeeper (knowledge base management with contradiction detection), Reporter (format and deliver via Telegram), and Trader (trade ticket creation). These agents are the intelligence core — they transform raw data into actionable insights and deliver them to the user.

**Why this feature exists:** Collector agents produce raw data. Reasoning agents produce the actual value: investment theses, contradiction alerts, formatted reports, and trade proposals. Without these, the platform has data but no intelligence.

---

## User Scenarios & Testing

### User Story 1 — Analyst Synthesis (Priority: P1)

As the system, I want an Analyst that synthesises Researcher data into investment theses so that users receive actionable insights instead of raw data.

**Why P1**: The Analyst is the brain of the platform. Every mission type (except standalone pattern_request) passes through the Analyst.

**Independent Test**: Call `runAnalyst({ researchData, existingThesis: null, mode: 'standard' })` and verify the output is a valid `AnalystOutput` with thesis, evidence, risks, and confidence.

**Acceptance Scenarios**:

1. **Given** `ResearchOutput` for NVDA, **When** `runAnalyst()` is called in standard mode, **Then** it returns `AnalystOutput` with `thesisUpdate`, `supportingEvidence[]`, `riskFactors[]`, `confidence`, `confidenceReason`
2. **Given** devil's advocate mode, **When** `runAnalyst()` is called, **Then** it uses `analyst.devil-advocate.prompt.ts` and `devilAdvocateTemperature` (0.7) from config
3. **Given** comparison mode with two `ResearchOutput` objects (NVDA + AMD), **When** `runAnalyst()` is called, **Then** it returns `AnalystOutput` with `comparisonTable` populated
4. **Given** `portfolioContext.quantity > 0` (user holds shares), **When** the Analyst runs, **Then** the system prompt includes portfolio context from `portfolio-context.prompt.ts`
5. **Given** the model returns malformed JSON, **Then** the function retries once before throwing
6. **Analyst has NO tools** — it uses `generateText` with zero `tools`, only system + user prompts

---

### User Story 2 — Bookkeeper KB Management (Priority: P1)

As the knowledge base, I want a Bookkeeper that detects contradictions, snapshots thesis history, and persists entries with vector embeddings so that the system maintains an auditable, searchable memory.

**Why P1**: Without the Bookkeeper, the KB is empty. Without the KB, the fast-path check in Manager doesn't work, `/thesis` and `/history` commands return nothing, and contradiction detection is impossible.

**Independent Test**: Call `runBookkeeper({ analystOutput, missionId, userId })` and verify KbEntry + KbThesisSnapshot records are created in the database with correct embedding vectors.

**Acceptance Scenarios**:

1. **Given** a new thesis (no prior entry), **When** `runBookkeeper()` runs, **Then** it creates a `KbEntry` with `changeType: 'initial'`, generates an embedding vector, and stores it in pgvector
2. **Given** an existing thesis for the same ticker, **When** `runBookkeeper()` runs, **Then** it creates a `KbThesisSnapshot` of the OLD thesis before writing the new one
3. **Given** contradiction detection finds a `HIGH` severity contradiction, **Then** it creates a `thesis_contradiction` Alert and flags the KB entry
4. **Given** contradiction detection finds `LOW` or `NONE`, **Then** no alert is created
5. **Given** devil's advocate mode, **When** `runBookkeeper()` runs, **Then** it still snapshots the existing thesis before the devil's advocate entry overwrites it
6. **Given** `changeType` is `'initial'` (no prior thesis exists), **Then** no snapshot is created (nothing to snapshot)
7. **Given** the embedding API call fails, **Then** the function throws (KB entries without embeddings are useless for RAG)
8. **All operations (KbEntry upsert + KbThesisSnapshot creation) MUST happen in a Prisma transaction**

---

### User Story 3 — Reporter Delivery (Priority: P1)

As a Telegram user, I want formatted, labeled reports delivered to me so that I can quickly understand the system's output.

**Why P1**: Reporter is the user-facing output of every mission. No Reporter = no output visible to the user.

**Independent Test**: Call `runReporter({ missionOutput, missionType: 'operator_query', userId })` and verify it calls `telegram.post()` with a correctly formatted message.

**Acceptance Scenarios**:

1. **Given** an `AnalystOutput` from an `operator_query` mission, **When** `runReporter()` runs, **Then** it formats the output with the correct label (📊 for standard analysis) and sends via Telegram
2. **Given** Reporter's primary provider is `lmstudio`, **When** LM Studio is available, **Then** it uses the local model for formatting (cost: $0)
3. **Given** LM Studio is unavailable, **When** Reporter runs, **Then** it falls back to OpenAI gpt-4o-mini
4. **Given** a `daily_brief` mission type, **When** Reporter runs, **Then** it also writes a `DailyBrief` database record (in addition to Telegram delivery)
5. **Reporter NEVER analyses** — it receives structured output and formats it for human consumption

---

### User Story 4 — Trader Ticket Creation (Priority: P2)

As a user, I want the Trader agent to create trade tickets based on analysis so that I can review and approve/reject proposed trades.

**Why P2**: Trading functionality is a demo feature that showcases the full pipeline depth. Core analysis works without it.

**Independent Test**: Call `runTrader({ ticker: 'NVDA', action: 'buy', quantity: 10, ... })` and verify a trade ticket is created via `trader-platform-mcp` with `pending_approval` status.

**Acceptance Scenarios**:

1. **Given** a trade request with sufficient analyst confidence, **When** `runTrader()` runs, **Then** it creates a trade ticket via `mcpTools.traderPlatform.create_ticket()`
2. **Given** the trade ticket, **Then** its rationale is exactly 3 sentences citing the analysis
3. **Given** ANY trade ticket, **Then** it includes: `"⚠️ This ticket requires explicit human approval. FinSight never executes trades autonomously."`
4. **Given** a ticker the user doesn't own and `action: 'sell'`, **Then** the Trader rejects the request with an error

---

### Edge Cases

- What if Analyst `confidence: 'low'` and `reDispatchOnLow` is enabled? → Handled by Manager (Feature 008), not Analyst itself
- What if embedding model returns wrong dimensions? → Zod validation on vector length (must be 1536) catches this
- What if Telegram API is down during Reporter delivery? → Reporter logs error, mission still completes (Reporter failure is non-fatal to the mission)
- What if Bookkeeper finds a contradiction but the KbEntry write fails? → Transaction rollback — alert is NOT created without the KB entry

---

## Requirements

### Functional Requirements

#### Analyst
- **FR-001**: `runAnalyst()` MUST accept `mode: 'standard' | 'devil_advocate' | 'comparison'`
- **FR-002**: In standard mode: MUST use `analyst.prompt.ts` system prompt with configured temperature
- **FR-003**: In devil's advocate mode: MUST use `analyst.devil-advocate.prompt.ts` with `devilAdvocateTemperature`
- **FR-004**: In comparison mode: MUST accept an array of `ResearchOutput` and produce `comparisonTable`
- **FR-005**: When `portfolioContext.quantity > 0`: MUST append `portfolio-context.prompt.ts` to the system prompt
- **FR-006**: MUST validate `AnalystOutput` shape — retry once on malformed JSON, then throw
- **FR-007**: Analyst has NO tools — `generateText` with no `tools` parameter

#### Bookkeeper
- **FR-008**: MUST fetch existing thesis via `ragRetrieval.get_current_thesis`
- **FR-009**: For non-initial entries: MUST snapshot existing thesis as `KbThesisSnapshot` before overwriting
- **FR-010**: MUST run contradiction check via `generateText` with `bookkeeper.contradiction.prompt.ts` and `response_format: { type: 'json_object' }`
- **FR-011**: If contradiction severity is `'high'`: MUST create `thesis_contradiction` Alert
- **FR-012**: MUST generate embedding via `openai.embeddings.create({ model: config.rag.embeddingModel, input: thesis })`
- **FR-013**: MUST upsert `KbEntry` + create `KbThesisSnapshot` in a single Prisma transaction
- **FR-014**: `changeType` values: `initial`, `update`, `contradiction`, `devil_advocate`
- **FR-015**: MUST update `Mission.status = 'complete'` after successful write

#### Reporter
- **FR-016**: MUST select output label from label system based on `missionType` and content
- **FR-017**: MUST use LM Studio (primary) or fallback for formatting — `generateText` with formatting prompt
- **FR-018**: MUST call Telegram API to deliver formatted message to user
- **FR-019**: For `daily_brief`: MUST also write `DailyBrief` database record
- **FR-020**: MUST split messages exceeding Telegram's 4096 character limit

#### Trader
- **FR-021**: MUST read current thesis via `mcpTools.ragRetrieval.get_current_thesis`
- **FR-022**: MUST use `generateText` to formulate exactly 3-sentence rationale
- **FR-023**: MUST call `mcpTools.traderPlatform.create_ticket()` with rationale
- **FR-024**: MUST always append the human-approval warning to every ticket
- **FR-025**: MUST return `{ ticketId }` to Manager for Reporter delivery

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `runAnalyst` standard mode returns valid `AnalystOutput` with confidence field
- **SC-002**: `runAnalyst` comparison mode returns `comparisonTable` in output
- **SC-003**: `runAnalyst` devil's advocate mode uses `devilAdvocateTemperature` (verified via spy)
- **SC-004**: `runBookkeeper` writes `KbEntry` with embedding vector to pgvector (integration test)
- **SC-005**: `runBookkeeper` writes `KbThesisSnapshot` with correct `changeType`
- **SC-006**: `runBookkeeper` creates `thesis_contradiction` Alert when contradiction found
- **SC-007**: `runBookkeeper` does NOT create alert when no contradiction
- **SC-008**: `runTrader` creates `TradeTicket` with `pending_approval` status
- **SC-009**: All unit tests pass with mocked LLM clients
