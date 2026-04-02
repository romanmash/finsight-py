# Data Model: Admin Dashboard Mission Control (010)

## Overview

Feature 010 introduces a frontend projection model and action contracts for admin operations. No new database tables are required.

## Entities

### 1. AdminSessionContext

- **Purpose**: Represents authenticated admin state in the dashboard runtime.
- **Fields**:
  - `isAuthenticated: boolean`
  - `principalRole: 'admin' | 'analyst' | 'viewer' | null`
  - `expiresAt: string | null`
  - `lastRefreshAt: string | null`
- **Validation Rules**:
  - Access to dashboard routes requires `isAuthenticated=true` and `principalRole='admin'`.
  - Session invalidation must clear all protected runtime state.

### 2. AdminStatusSnapshot

- **Purpose**: Canonical status payload returned by `GET /api/admin/status`.
- **Fields**:
  - `generatedAt: string`
  - `degraded: boolean`
  - `agents: Record<AgentName, AgentStatusEntry>`
  - `spend: SpendSummary`
  - `mission: MissionSummary`
  - `health: HealthSummary`
  - `kb: KbSummary`
  - `queues: QueueSummary`
  - `errors: StatusError[]`
- **Validation Rules**:
  - All 9 agent keys must be present in `agents`.
  - `generatedAt` must be parseable as ISO timestamp.
  - `degraded=true` when one or more critical sections report errors.

### 3. AgentStatusEntry

- **Purpose**: Per-agent runtime state shown on the agent floor.
- **Fields**:
  - `state: 'active' | 'queued' | 'idle' | 'error'`
  - `currentTask: string | null`
  - `currentMissionId: string | null`
  - `model: string | null`
  - `provider: string | null`
  - `todayTokensIn: number`
  - `todayTokensOut: number`
  - `todayCostUsd: number`
  - `lastActiveAt: string | null`
  - `errorMessage: string | null`
- **Validation Rules**:
  - Numeric counters default to `0` when absent.
  - `state` values are restricted to enumerated set.

### 4. MissionSummary

- **Purpose**: Current and recent mission context for mission panels/log.
- **Fields**:
  - `active: ActiveMission | null`
  - `recent: RecentMission[]`
- **Validation Rules**:
  - `recent` is descending by recency and bounded to latest 10 entries.
  - `active` may be `null` when no running mission exists.

### 5. HealthSummary

- **Purpose**: Service health representation for platform dependencies.
- **Fields**:
  - `postgres: ServiceHealthEntry`
  - `redis: ServiceHealthEntry`
  - `mcpServers: Record<string, ServiceHealthEntry>`
  - `lmStudio: ServiceHealthEntry`
  - `telegramBot: ServiceHealthEntry`
- **Validation Rules**:
  - `status` constrained to `'ok' | 'degraded' | 'error'`.
  - Every entry includes `checkedAt` timestamp.

### 6. SpendSummary

- **Purpose**: Daily spend overview for budget control.
- **Fields**:
  - `todayTotalUsd: number`
  - `byProvider: Record<string, number>`
- **Validation Rules**:
  - Provider entries are non-negative numbers.
  - Sum of provider values should match `todayTotalUsd` within rounding tolerance.

### 7. AdminActionRequest / AdminActionResult

- **Purpose**: Contract for admin-triggered actions.
- **Action Types**:
  - `reload_config`
  - `trigger_screener`
  - `trigger_watchdog`
- **Result Fields**:
  - `ok: boolean`
  - `message: string`
  - `details?: object`
- **Validation Rules**:
  - All action invocations return deterministic success/failure payload for operator feedback.

## Relationships

- `AdminSessionContext` gates all reads/writes in dashboard UI.
- `AdminStatusSnapshot` composes `AgentStatusEntry`, `MissionSummary`, `HealthSummary`, `SpendSummary`.
- `AdminActionRequest` can trigger backend state changes that become visible via subsequent `AdminStatusSnapshot` polling.

## State Transitions

### Session State

- `unauthenticated -> authenticated` on successful admin login.
- `authenticated -> unauthenticated` on logout, refresh failure, or authorization failure.

### Status Refresh State

- `fresh -> stale` when poll fails.
- `stale -> fresh` when next poll succeeds.
- `polling -> paused` when tab hidden.
- `paused -> polling` when tab visible again.

### Action State

- `idle -> pending` on action click.
- `pending -> success|failure` on API acknowledgment.
