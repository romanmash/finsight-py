# Data Model: Seed & Infrastructure Readiness (011)

## Overview

Feature 011 does not introduce new production database tables. It defines deterministic seed projections over existing domain models plus operational entities for deployment/infrastructure workflows.

## Seed Projection Entities

### 1. SeedProfile

- **Purpose**: Declares the target demo baseline composition for one seed run.
- **Fields**:
  - `profileName: string`
  - `version: string`
  - `includes: string[]` (users, holdings, watchlists, kb, snapshots, screener, alerts, missions, ingestion)
  - `strictMode: boolean`
- **Validation Rules**:
  - `version` must be explicit for change traceability.
  - `includes` must cover all demo-critical domains required by FR-004..FR-008.

### 2. SeedRunResult

- **Purpose**: Captures deterministic outcome of one seed execution.
- **Fields**:
  - `startedAt: string`
  - `finishedAt: string`
  - `status: 'success' | 'failed'`
  - `createdCounts: Record<string, number>`
  - `updatedCounts: Record<string, number>`
  - `warnings: string[]`
  - `errorMessage: string | null`
- **Validation Rules**:
  - `status='failed'` requires non-empty `errorMessage`.
  - Count maps must contain non-negative integers.

### 3. SeedUserProjection (maps to `User`)

- **Purpose**: Seeded identity/persona baseline used in demo and auth flows.
- **Key Fields**:
  - `email`
  - `role`
  - `active`
  - `telegramHandle` (optional)
- **Validation Rules**:
  - Email uniqueness maintained by existing schema.
  - Credential-sensitive values are sourced from environment/config, never hardcoded secrets.

### 4. SeedPortfolioProjection (maps to `PortfolioItem`, `WatchlistItem`)

- **Purpose**: Demo holdings and watchlist context.
- **Key Fields**:
  - `userId`
  - `ticker`
  - `quantity` (portfolio)
  - `listType` (watchlist)
  - `active`
- **Validation Rules**:
  - Existing unique constraints (`userId+ticker`, `userId+ticker+listType`) define idempotency keys.

### 5. SeedKnowledgeProjection (maps to `KbEntry`, `KbThesisSnapshot`)

- **Purpose**: Current thesis and temporal thesis-history progression.
- **Key Fields**:
  - `ticker`
  - `entryType`
  - `content`
  - `metadata`
  - `changeType` (snapshot)
  - `createdAt` ordering anchors
- **Validation Rules**:
  - History sequence must be chronologically coherent.
  - At least one contradiction transition must exist for demo narrative continuity.

### 6. SeedMissionProjection (maps to `Mission`, `AgentRun`, `Alert`, `ScreenerRun`)

- **Purpose**: Operational history baseline for dashboard/API/telegram visibility.
- **Key Fields**:
  - Mission: `type`, `status`, `trigger`, `tickers`, `createdAt/completedAt`
  - AgentRun: `agentName`, `provider`, `model`, `status`, `tokensIn`, `tokensOut`, `costUsd`
  - Alert: `alertType`, `severity`, `acknowledged`
  - ScreenerRun: `results`, `triggeredBy`
- **Validation Rules**:
  - Mission-to-AgentRun relationships must remain referentially valid.
  - Alert and screener records must be non-empty and operator-visible post-seed.

## Operational Entities (Non-DB)

### 7. PipelineGateResult

- **Purpose**: Represents CI stage outcome controlling deploy eligibility.
- **Fields**:
  - `stage: 'typecheck' | 'lint' | 'test' | 'build' | 'deploy'`
  - `status: 'passed' | 'failed' | 'skipped'`
  - `startedAt: string`
  - `finishedAt: string`
  - `logRef: string | null`
- **Validation Rules**:
  - `deploy` cannot be `passed` if any prior mandatory stage failed.

### 8. DeploymentTarget

- **Purpose**: Defines remote deployment endpoint and health expectations.
- **Fields**:
  - `name: string`
  - `host: string`
  - `user: string`
  - `composeProject: string`
  - `healthEndpoints: string[]`
- **Validation Rules**:
  - Host/user must be present before sync/restart operations.
  - Health endpoint list must include all required runtime services.

### 9. EnvVariableSpec

- **Purpose**: Contract for required environment variables documented in `.env.example`.
- **Fields**:
  - `key: string`
  - `required: boolean`
  - `purpose: string`
  - `exampleFormat: string`
  - `scope: 'local' | 'ci' | 'deploy' | 'runtime'`
- **Validation Rules**:
  - Required keys must have startup-path coverage.
  - Sensitive keys must be represented as placeholders only in tracked files.

## Relationships

- `SeedProfile` drives `SeedUserProjection`, `SeedPortfolioProjection`, `SeedKnowledgeProjection`, and `SeedMissionProjection` composition.
- `SeedRunResult` summarizes reconciliation activity across all seed projections.
- `PipelineGateResult` governs when `DeploymentTarget` actions can execute.
- `EnvVariableSpec` constrains both seed runtime and deployment automation behavior.

## State Transitions

### Seed Lifecycle

- `planned -> running -> success`
- `planned -> running -> failed`
- `success -> running -> success` (idempotent rerun path)

### CI/CD Lifecycle

- `validation_pending -> validation_running -> validation_passed`
- `validation_running -> validation_failed` (deploy blocked)
- `validation_passed -> deploy_running -> deploy_passed|deploy_failed`

### Deployment Script Lifecycle

- `preflight -> sync -> restart -> healthcheck -> complete`
- any stage `-> failed` with non-zero exit and diagnostics
