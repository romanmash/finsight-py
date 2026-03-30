# Feature Specification: Foundation & Config System

**Feature**: `001-foundation-config`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/constitution.md`](../../.specify/constitution.md)

## Overview

Bootstrap the pnpm monorepo workspace, create the `@finsight/shared-types` package containing all domain types and const enums, create all runtime YAML configuration files with Zod validation schemas, and implement the config loader with hot-reload capability. This is the dependency-free foundation that every other feature imports from.

**Why this feature exists:** Every agent, every MCP server, every route, and every worker imports types from `@finsight/shared-types` and reads configuration via the config loader. Nothing else can be built until this foundation is solid.

---

## User Scenarios & Testing

### User Story 1 — Monorepo & Shared Types (Priority: P1)

As a developer, I want a properly structured pnpm workspace with a shared types package so that all domain types are defined once and imported consistently across the entire codebase.

**Why P1**: This is the literal foundation. Every other feature depends on these types existing. Without this, nothing compiles.

**Independent Test**: Run `pnpm -r typecheck` and verify zero errors. Import `AgentName` and `MissionType` from `@finsight/shared-types` in a test file and verify they resolve correctly.

**Acceptance Scenarios**:

1. **Given** the monorepo is initialized, **When** I run `pnpm -r typecheck`, **Then** it passes with zero errors across all packages
2. **Given** the shared-types package is built, **When** I import `{ AgentName, MissionType, Provider }` from `@finsight/shared-types`, **Then** all types resolve with full IntelliSense support
3. **Given** the shared-types package.json, **When** I inspect its dependencies, **Then** it has zero runtime dependencies (types-only package)

---

### User Story 2 — Configuration YAML Files (Priority: P1)

As an operator, I want all system behavior configured via YAML files so that I can tune agent models, thresholds, schedules, and pricing without touching code.

**Why P1**: The config system controls which models agents use, how often Watchdog scans, what cache TTLs apply, and what pricing rates are charged. Every subsequent feature reads from config.

**Independent Test**: Open any `config/runtime/*.yaml` file, modify a value (e.g., change Watchdog schedule), and verify the system picks up the change on reload.

**Acceptance Scenarios**:

1. **Given** all 11 YAML files exist in `config/runtime/`, **When** the API starts, **Then** all files are parsed and validated without error
2. **Given** `agents.yaml` defines all 9 agents with primary model configs, **When** I read `getConfig().agents.manager.primary`, **Then** it returns `{ provider: 'anthropic', model: 'claude-sonnet-4-20250514', temperature: 0.2, maxTokens: 2048 }`
3. **Given** `pricing.yaml` defines per-model token costs, **When** I call `computeCostUsd('anthropic', 'claude-sonnet-4-20250514', 1000, 500)`, **Then** it returns the correct USD value based on the YAML rates

---

### User Story 3 — Config Loader with Validation (Priority: P1)

As a developer, I want a config loader that validates all YAML against Zod schemas at startup so that misconfigured values are caught immediately — not at runtime when an agent fails.

**Why P1**: A single typo in `agents.yaml` (wrong provider name, missing temperature) could cause silent failures hours into a demo. Fail-fast validation is mandatory per the constitution.

**Independent Test**: Deliberately break a YAML file (remove a required field), start the API, and verify it exits with code 1 and a descriptive error message including the exact field path.

**Acceptance Scenarios**:

1. **Given** all YAML files are valid, **When** `initConfig()` is called at startup, **Then** it succeeds and `getConfig()` returns the full `AppConfig` object
2. **Given** `agents.yaml` is missing `manager.primary.provider`, **When** `initConfig()` is called, **Then** it calls `process.exit(1)` with an error message containing `"agents.manager.primary.provider"`
3. **Given** `agents.yaml` has `temperature: "hot"` (wrong type), **When** `initConfig()` is called, **Then** it calls `process.exit(1)` with a Zod validation error
4. **Given** the config is loaded, **When** I call `getConfig()` multiple times, **Then** it returns the cached value (synchronous, no file I/O)

---

### User Story 4 — Config Hot-Reload (Priority: P2)

As an operator, I want to reload configuration at runtime without restarting the API so that I can tune thresholds during a live demo.

**Why P2**: Important for demo flexibility but the system works with cold-start config. Hot-reload is a polish feature.

**Independent Test**: Start the API, modify `watchdog.yaml`, call `POST /admin/config/reload`, and verify the response lists `watchdog` as a changed key.

**Acceptance Scenarios**:

1. **Given** the API is running, **When** I modify `watchdog.yaml` and call `reloadConfig()`, **Then** it returns `{ changed: ['watchdog'] }` and `getConfig().watchdog` reflects the new values
2. **Given** the API is running, **When** I modify `watchdog.yaml` with an invalid value and call `reloadConfig()`, **Then** it returns an error and the existing config is preserved (no partial update)
3. **Given** Docker config is mounted `:ro`, **When** `POST /admin/config/reload` is called, **Then** it re-reads the files (chokidar watch is supplementary, not required)

---

### User Story 5 — Pricing Calculator (Priority: P2)

As an operator, I want accurate cost tracking per LLM call so that I can monitor daily spend on the admin dashboard.

**Why P2**: Cost tracking is essential for the demo but depends on the config system being in place first.

**Independent Test**: Call `computeCostUsd('openai', 'gpt-4o', 1000, 500)` and verify the result matches manual calculation from `pricing.yaml` rates.

**Acceptance Scenarios**:

1. **Given** `pricing.yaml` defines Anthropic Claude Sonnet rates, **When** `computeCostUsd('anthropic', 'claude-sonnet-4-20250514', 1000, 500)` is called, **Then** it returns the correct value: `(1000 × inputRate + 500 × outputRate)`
2. **Given** provider is `lmstudio`, **When** `computeCostUsd('lmstudio', 'any-model', 5000, 3000)` is called, **Then** it returns `0` (local models are free)
3. **Given** an unknown model not in `pricing.yaml`, **When** `computeCostUsd('openai', 'unknown-model', 1000, 500)` is called, **Then** it returns `0` and logs a warning (never throws, never blocks)

---

### Edge Cases

- What happens when a YAML file is empty? → `initConfig()` exits with `process.exit(1)` and descriptive error
- What happens when `config/runtime/` directory doesn't exist? → `initConfig()` exits with `process.exit(1)` and path error
- What happens when two YAML files reference the same enum value differently? → Zod schemas enforce exact enum matches
- What happens when `pricing.yaml` has negative token rates? → Zod schema enforces `z.number().nonnegative()`

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST use pnpm workspaces with `packages/*` and `apps/*` workspace patterns
- **FR-002**: `@finsight/shared-types` MUST export all 9 agent names, 8 mission types, 4 mission statuses, 5 mission triggers, 7 alert types, 3 alert severities, 5 ticket statuses, 3 user roles, 4 providers, 3 confidence levels, and 3 analyst modes as const enum objects + inferred types
- **FR-003**: `@finsight/shared-types` MUST export typed interfaces: `AgentConfig`, `AgentModelConfig`, `ResearchOutput`, `AnalystOutput`, `TechnicianOutput`, `BookkeeperInput`, `KbEntrySnippet`
- **FR-004**: `@finsight/shared-types` MUST export MCP output types: `QuoteOutput`, `OhlcvOutput`, `FundamentalsOutput`, `EarningsOutput`, `AnalystRatingsOutput`, `PriceTargetsOutput`
- **FR-005**: `@finsight/shared-types` MUST export API response types: `AdminStatusResponse`, `MissionResponse`, `ChatResponse`
- **FR-006**: `@finsight/shared-types` MUST have zero runtime dependencies
- **FR-007**: System MUST create 11 YAML configuration files covering: agents, pricing, MCP servers, scheduler, watchdog, screener, RAG, trader, auth, telegram, app
- **FR-008**: Each YAML file MUST have a corresponding Zod schema in `config/types/*.schema.ts`
- **FR-009**: `initConfig()` MUST parse all YAML files at startup and validate against Zod schemas
- **FR-010**: `initConfig()` MUST call `process.exit(1)` with exact field path on validation failure
- **FR-011**: `getConfig()` MUST be synchronous (return cached value, no file I/O)
- **FR-012**: `reloadConfig()` MUST re-parse only changed files, validate, merge into cache, and return list of changed top-level keys
- **FR-013**: `reloadConfig()` MUST NOT apply partial updates — if validation fails, existing config is preserved
- **FR-014**: `computeCostUsd()` MUST calculate cost from `pricing.yaml` rates: `(tokensIn × inputRate) + (tokensOut × outputRate)`
- **FR-015**: `computeCostUsd()` MUST return `0` for `lmstudio` provider (local models are free)
- **FR-016**: `computeCostUsd()` MUST return `0` and log a warning for unknown models (never throw)

### Key Entities

- **AppConfig**: Top-level merged configuration object returned by `getConfig()`. Contains all 11 validated config sections.
- **AgentConfig**: Per-agent model configuration with `primary` and optional `fallback` provider settings.
- **PricingConfig**: Per-provider, per-model token rates (input/output cost per token in USD).

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `pnpm -r typecheck` passes with zero errors across the entire monorepo
- **SC-002**: `@finsight/shared-types` builds to `dist/` and all types are importable
- **SC-003**: `initConfig()` succeeds with all 11 valid YAML files
- **SC-004**: `initConfig()` exits with code 1 on any invalid YAML field (tested with at least 3 different validation failures)
- **SC-005**: `reloadConfig()` correctly detects and returns changed keys
- **SC-006**: `computeCostUsd()` returns correct values for all 4 known providers
- **SC-007**: All unit tests pass without network access

---

## Configuration Details

### agents.yaml structure (all 9 agents)

```yaml
manager:
  primary: { provider: anthropic, model: claude-sonnet-4-20250514, temperature: 0.2, maxTokens: 2048 }
  fallback: { provider: azure, model: gpt-4o, temperature: 0.2, maxTokens: 2048 }

watchdog:
  primary: { provider: openai, model: gpt-4o-mini, temperature: 0.1, maxTokens: 2048 }

screener:
  primary: { provider: openai, model: gpt-4o-mini, temperature: 0.2, maxTokens: 2048 }

researcher:
  primary: { provider: openai, model: gpt-4o, temperature: 0.2, maxTokens: 8192 }

analyst:
  primary: { provider: anthropic, model: claude-sonnet-4-20250514, temperature: 0.3, maxTokens: 4096 }
  fallback: { provider: azure, model: gpt-4o, temperature: 0.3, maxTokens: 4096 }
  devilAdvocateTemperature: 0.7

technician:
  primary: { provider: openai, model: gpt-4o, temperature: 0.2, maxTokens: 2048 }

bookkeeper:
  primary: { provider: openai, model: gpt-4o-mini, temperature: 0.1, maxTokens: 1024 }

reporter:
  primary: { provider: lmstudio, model: llama-3.2-8b-instruct, temperature: 0.5, maxTokens: 4096 }
  fallback: { provider: openai, model: gpt-4o-mini, temperature: 0.5, maxTokens: 4096 }

trader:
  primary: { provider: openai, model: gpt-4o-mini, temperature: 0.1, maxTokens: 1024 }
```

### pricing.yaml structure

```yaml
providers:
  anthropic:
    claude-sonnet-4-20250514: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 }
  openai:
    gpt-4o:      { inputPer1kTokens: 0.0025, outputPer1kTokens: 0.01 }
    gpt-4o-mini: { inputPer1kTokens: 0.00015, outputPer1kTokens: 0.0006 }
  azure:
    gpt-4o:      { inputPer1kTokens: 0.0025, outputPer1kTokens: 0.01 }
  lmstudio:
    "*": { inputPer1kTokens: 0, outputPer1kTokens: 0 }

dailyBudgetUsd: 5.00
alertThresholdPct: 80
```

### Shared Types — Full Const Enum + Interface Catalogue

All const enums and interfaces are defined in `packages/shared-types/src/` across 4 files:

- `agents.types.ts`: `AgentName`, `AgentState`, `Provider`, `Confidence`, `AnalystMode`, `AgentConfig`, `AgentModelConfig`, `ResearchOutput`, `AnalystOutput`, `TechnicianOutput`, `BookkeeperInput`, `KbEntrySnippet`
- `missions.types.ts`: `MissionType`, `MissionStatus`, `MissionTrigger`, `AlertType`, `AlertSeverity`, `ChangeType`, `TicketStatus`, `UserRole`
- `mcp.types.ts`: `QuoteOutput`, `OhlcvOutput`, `FundamentalsOutput`, `EarningsOutput`, `AnalystRatingsOutput`, `PriceTargetsOutput`
- `api.types.ts`: `AdminStatusResponse`, `ChatResponse`, `MissionResponse`
- `index.ts`: re-exports everything
