# Data Model: Reasoning Agents (007)

## Overview

This model defines the reasoning-layer runtime entities and handoff payloads consumed by orchestration (008) and persisted in platform storage.

## Entities

### 1) ReasoningAnalysisOutput

- **Purpose**: Structured synthesis result produced by Analyst.
- **Core fields**:
  - `ticker` (`string | string[]` depending on mode)
  - `mode` (`standard` | `devil_advocate` | `comparison`)
  - `thesisUpdate` (`string`)
  - `supportingEvidence` (`string[]`)
  - `riskFactors` (`string[]`)
  - `contradictions` (`string[]`)
  - `confidence` (`low` | `medium` | `high`)
  - `confidenceReason` (`string`)
  - `comparisonTable` (optional, mode-specific)
- **Validation rule**: payload must pass output schema; one retry is allowed on malformed model response.

### 2) KnowledgeBaseEntry (Reasoning Write Target)

- **Purpose**: Current thesis memory entry persisted by Bookkeeper.
- **Backed by**: `KbEntry` model.
- **Relevant fields**:
  - `userId`
  - `ticker`
  - `content`
  - `changeType` (`initial` | `update` | `contradiction` | `devil_advocate`)
  - `embedding` (vector)
  - `contradictionFlag`
  - `updatedAt`
- **Validation rule**: entry persistence requires valid embedding generation.

### 3) ThesisSnapshot

- **Purpose**: Historical immutable copy of prior thesis before non-initial overwrite.
- **Backed by**: `KbThesisSnapshot` model.
- **Relevant fields**:
  - `kbEntryId`
  - `previousContent`
  - `previousChangeType`
  - `capturedAt`
- **State rule**: created only when prior thesis exists.

### 4) ContradictionAssessment

- **Purpose**: Classification result of prior vs new thesis consistency.
- **Runtime fields**:
  - `severity` (`none` | `low` | `high`)
  - `summary`
  - `evidence`
- **Side effect rule**: high severity creates `thesis_contradiction` alert; low/none does not.

### 5) ReasoningReportMessage

- **Purpose**: User-facing formatted mission output produced by Reporter.
- **Fields**:
  - `missionId`
  - `missionType`
  - `label`
  - `textChunks[]` (ordered chunked output for platform limits)
  - `deliveredAt`
- **State rule**: formatting and delivery are distinct steps; delivery failures are observable.

### 6) DailyBriefRecord

- **Purpose**: Persisted daily brief artifact for mission type `daily_brief`.
- **Backed by**: `DailyBrief` model.
- **Relevant fields**:
  - `userId`
  - `date`
  - `summary`
  - `highlights`
  - `riskNotes`
- **State rule**: created in addition to chat delivery for daily brief missions.

### 7) TradeTicketProposal

- **Purpose**: Pending approval trade intent produced by Trader.
- **Backed by**: `TradeTicket` model (or equivalent ticket store).
- **Fields**:
  - `userId`
  - `ticker`
  - `action` (`buy` | `sell`)
  - `quantity`
  - `rationale` (exactly 3 sentences)
  - `warningText` (human-approval required)
  - `status` (`pending_approval`)
- **Validation rule**: reject sell proposal when user lacks position.

## Relationships

- `ReasoningAnalysisOutput` is the input to both `KnowledgeBaseEntry` writes (Bookkeeper) and `ReasoningReportMessage` formatting (Reporter).
- `KnowledgeBaseEntry` update may create `ThesisSnapshot` and optionally `ContradictionAssessment`-driven alert as one transactional unit.
- `ReasoningReportMessage` is generated from analysis/ticket outputs and delivered to user-facing channels.
- `DailyBriefRecord` is created when report mission type is daily brief.
- `TradeTicketProposal` consumes current thesis context and is routed downstream for human approval handling by orchestration.

## State Transitions

### KB Update Path

1. Fetch prior thesis state.
2. Classify change type.
3. Run contradiction assessment.
4. Generate embedding.
5. Transactionally write entry + snapshot (if needed) + contradiction effects.

### Report Path

1. Select label by mission type/content.
2. Format output with provider fallback.
3. Chunk output if needed.
4. Deliver chunks.
5. Persist brief record when mission type is `daily_brief`.

### Trade Ticket Path

1. Load current thesis and position context.
2. Validate trade intent (including sell-position guardrail).
3. Generate three-sentence rationale.
4. Create pending-approval ticket with required warning text.
