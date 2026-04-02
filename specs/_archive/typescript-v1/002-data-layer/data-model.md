# Data Model: Data Layer (002)

## Overview

This feature defines persistence and infrastructure entities used by all later features. The model is relational with JSON payload fields for flexible mission/agent outputs and pgvector embeddings for KB retrieval.

## Entities

### 1) User
- **Primary fields**: `id`, `email` (unique), `passwordHash`, `name`, `role`, `telegramHandle` (unique nullable), `telegramChatId` (nullable), `active`, `createdAt`, `createdBy`
- **Relationships**: one-to-many with `RefreshToken`, `PortfolioItem`, `WatchlistItem`, `Mission`, `Alert`, `DailyBrief`, `TradeTicket`
- **Validation rules**: `role` constrained to domain enum values at app layer

### 2) RefreshToken
- **Primary fields**: `id`, `userId`, `token` (unique), `expiresAt`, `createdAt`
- **Relationships**: many-to-one `User` (cascade delete)

### 3) PortfolioItem
- **Primary fields**: `id`, `userId`, `ticker`, `quantity`, `updatedAt`
- **Relationships**: many-to-one `User`
- **Validation rules**: unique compound (`userId`, `ticker`)

### 4) WatchlistItem
- **Primary fields**: `id`, `userId`, `ticker`, `name`, `sector`, `listType`, `addedAt`, `active`
- **Relationships**: many-to-one `User`, one-to-many `PriceSnapshot`
- **Validation rules**: unique compound (`userId`, `ticker`, `listType`)

### 5) PriceSnapshot
- **Primary fields**: `id`, `ticker`, `watchlistItemId`, `price`, `changePct`, `volume`, `capturedAt`
- **Relationships**: many-to-one `WatchlistItem`
- **Indexes**: (`ticker`, `capturedAt`)

### 6) Mission
- **Primary fields**: `id`, `userId`, `type`, `status`, `trigger`, `inputData`, `outputData`, `tickers`, `createdAt`, `completedAt`
- **Relationships**: optional many-to-one `User`; one-to-many `AgentRun`, `Alert`, `KbEntry`, `KbThesisSnapshot`, `DailyBrief`, `TradeTicket`
- **State transitions**:
  - `pending` -> `running` -> `complete`
  - `pending` -> `running` -> `failed`

### 7) AgentRun
- **Primary fields**: `id`, `missionId`, `agentName`, `model`, `provider`, `inputData`, `outputData`, `toolCalls`, `confidence`, `confidenceReason`, `durationMs`, `tokensIn`, `tokensOut`, `costUsd`, `status`, `errorMessage`, `createdAt`
- **Relationships**: many-to-one `Mission`
- **Purpose**: observability and deterministic cost accounting support

### 8) KbEntry
- **Primary fields**: `id`, `ticker`, `entryType`, `content`, `embedding` (`vector(1536)`), `metadata`, `contradictionFlag`, `contradictionNote`, `missionId`, `createdAt`, `updatedAt`
- **Relationships**: optional many-to-one `Mission`
- **Indexes**: `ticker`, `entryType`, `createdAt`

### 9) KbThesisSnapshot
- **Primary fields**: `id`, `ticker`, `thesis`, `confidence`, `changeType`, `changeSummary`, `missionId`, `createdAt`
- **Relationships**: optional many-to-one `Mission`
- **Indexes**: (`ticker`, `createdAt`), (`missionId`)

### 10) ScreenerRun
- **Primary fields**: `id`, `results`, `triggeredBy`, `createdAt`
- **Relationships**: none

### 11) Alert
- **Primary fields**: `id`, `userId`, `ticker`, `alertType`, `severity`, `message`, `acknowledged`, `missionId`, `createdAt`
- **Relationships**: optional many-to-one `User`, optional many-to-one `Mission`

### 12) DailyBrief
- **Primary fields**: `id`, `userId`, `date`, `topSignals`, `thesisUpdates`, `upcomingEvents`, `screenerFinds`, `watchlistSummary`, `analystConsensus`, `pendingTickets`, `rawText`, `missionId`, `generatedAt`
- **Relationships**: many-to-one `User`, optional many-to-one `Mission`
- **Validation rules**: unique compound (`userId`, `date`)

### 13) TradeTicket
- **Primary fields**: `id`, `userId`, `ticker`, `action`, `quantity`, `rationale`, `confidence`, `basedOnMissions`, `status`, `expiresAt`, `approvedBy`, `approvedAt`, `rejectedBy`, `rejectionReason`, `mockExecutionPrice`, `mockExecutedAt`, `missionId`, `createdAt`
- **Relationships**: many-to-one `User`, optional many-to-one `Mission`
- **State transitions**:
  - `pending_approval` -> `approved`
  - `pending_approval` -> `rejected`
  - `pending_approval` -> `expired`
  - `approved` -> `cancelled` (manual/admin flow)

## Queue Domain Objects

### BullMQ Queues
- `watchdogScan` (repeatable)
- `screenerScan` (repeatable)
- `dailyBrief` (repeatable)
- `earningsCheck` (repeatable)
- `ticketExpiry` (repeatable)
- `alertPipeline` (standard)

### Redis Key Patterns
- `agent:state:{agentName}`
- `mcp:{server}:{tool}:{hash}`
