# Implementation Plan: Foundation & Config System

**Branch**: `001-foundation-config`
**Date**: 2026-03-28
**Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `specs/001-foundation-config/spec.md`

---

## Technical Context

### Dependencies
None. This is the root of the dependency tree — every other spec depends on this one.

### Key Technical Decisions

1. **Const enum pattern** — Use `as const` objects + `typeof X[keyof typeof X]` for all enums. This produces string literal union types that are compatible with Prisma string fields and JSON serialisation. No TypeScript `enum` keyword (it generates runtime code and has known footguns with isolatedModules).

2. **Config loader is async at init, sync at read** — `initConfig()` is async (reads files), called once at startup. `getConfig()` is synchronous (returns cached object). This avoids async infection throughout the codebase while keeping I/O at the boundary.

3. **One Zod schema per YAML file** — Each `config/types/*.schema.ts` exports a Zod schema and an inferred TypeScript type. The config loader uses the schema for validation and the type for the return value. This eliminates type/validation drift.

4. **js-yaml for parsing** — Lightweight, well-maintained, no security issues with `safeLoad` (default in v4+). No YAML anchors or custom tags needed.

5. **Pricing calculator is pure** — `computeCostUsd()` reads from the cached config (synchronous) and does arithmetic. No I/O, no side effects, easily testable.

### Constitution Compliance

- **Everything-as-Code (§I)**: All 11 YAML files are committed, validated by Zod at startup.
- **Fail-Safe Defaults (§V)**: `initConfig()` calls `process.exit(1)` on any validation failure.
- **Cost Observability (§IV)**: `pricing.ts` provides the `computeCostUsd()` function used by all agents.
- **Simplicity (§VII)**: Direct Zod validation, no config framework.

---

## Project Structure

### Files to Create

```
# Root workspace config
pnpm-workspace.yaml
package.json
tsconfig.base.json
eslint.config.js
.npmrc

# Shared types package
packages/shared-types/package.json
packages/shared-types/tsconfig.json
packages/shared-types/src/index.ts
packages/shared-types/src/agents.types.ts
packages/shared-types/src/missions.types.ts
packages/shared-types/src/mcp.types.ts
packages/shared-types/src/api.types.ts

# API app scaffold (just enough for config)
apps/api/package.json
apps/api/tsconfig.json

# Config YAML files (11 files)
config/runtime/agents.yaml
config/runtime/pricing.yaml
config/runtime/mcp.yaml
config/runtime/scheduler.yaml
config/runtime/watchdog.yaml
config/runtime/screener.yaml
config/runtime/rag.yaml
config/runtime/trader.yaml
config/runtime/auth.yaml
config/runtime/telegram.yaml
config/runtime/app.yaml

# Zod validation schemas (11 files)
config/types/agents.schema.ts
config/types/pricing.schema.ts
config/types/mcp.schema.ts
config/types/scheduler.schema.ts
config/types/watchdog.schema.ts
config/types/screener.schema.ts
config/types/rag.schema.ts
config/types/trader.schema.ts
config/types/auth.schema.ts
config/types/telegram.schema.ts
config/types/app.schema.ts
config/types/index.ts

# Config loader & pricing
apps/api/src/lib/config.ts
apps/api/src/lib/pricing.ts

# Tests
packages/shared-types/src/__tests__/types.test.ts
apps/api/src/lib/__tests__/config.test.ts
apps/api/src/lib/__tests__/pricing.test.ts
```

### Package Dependencies

**Root `package.json`**:
```json
{
  "name": "finsight-ai-hub",
  "private": true,
  "scripts": {
    "typecheck": "pnpm -r --if-present typecheck",
    "lint": "pnpm -r --if-present lint",
    "test": "pnpm -r --if-present test",
    "build": "pnpm -r --if-present build"
  },
  "devDependencies": {
    "typescript": "~5.8.0",
    "@types/node": "^20.0.0",
    "vitest": "^3.1.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "eslint": "^9.0.0"
  }
}
```

ESLint flat config (`eslint.config.js` at root) is set up here so `pnpm -r lint` works from spec 001 onward (constitution quality gate). Each workspace package inherits the root config.

**`packages/shared-types/package.json`**:
- Zero runtime dependencies (FR-006)
- `devDependencies`: `typescript`

**`apps/api/package.json`**:
```json
{
  "name": "@finsight/api",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src --max-warnings 0"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "zod": "^3.24.0",
    "@finsight/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.0",
    "typescript": "~5.8.0",
    "vitest": "^3.1.0"
  }
}
```

Note: `pino`, `hono`, and remaining API deps are added in spec 003. This spec only adds what is needed for config + pricing.

---

## Implementation Details

### 1. Monorepo Scaffold

**File: `pnpm-workspace.yaml`**
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

Note: `config/types/` is NOT a workspace package — it's a plain directory of TypeScript files imported by the API via relative paths or a tsconfig path alias. No `package.json` needed there.

**File: `package.json`** (root)
- Workspace scripts use `pnpm -r --if-present <script>` so packages without a given script are silently skipped rather than erroring
- `engines: { node: ">=20" }`

**File: `tsconfig.base.json`**
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- `target: "ES2022"`, `module: "Node16"`, `moduleResolution: "Node16"`
- Shared by all workspace packages via `extends`

**File: `eslint.config.js`**
- ESLint 9 flat config with `@typescript-eslint` rules
- `no-explicit-any: error` (enforces no `any` per CLAUDE.md rule 4)
- `explicit-function-return-type: error` (enforces explicit return types)
- Applied to all `**/*.ts` files across the workspace
- Each package's `lint` script runs `eslint src --max-warnings 0`

**File: `.npmrc`**
- `link-workspace-packages=true`, `prefer-workspace-packages=true`

---

### 2. Shared Types Package (`packages/shared-types/`)

**File: `src/agents.types.ts`**
- Const objects: `AgentName` (9 values), `AgentState` (4), `Provider` (4), `Confidence` (3), `AnalystMode` (3)
- Interfaces: `AgentModelConfig`, `AgentConfig`, `ResearchOutput`, `AnalystOutput`, `TechnicianOutput`, `BookkeeperInput`, `KbEntrySnippet`
- All interface fields per SPECKIT.md Spec 1 definitions
- Every interface has JSDoc (constitution quality gate)

**File: `src/missions.types.ts`**
- Const objects: `MissionType` (8), `MissionStatus` (4), `MissionTrigger` (5), `AlertType` (7), `AlertSeverity` (3), `ChangeType` (4), `TicketStatus` (5), `UserRole` (3)
- Note: FR-002 says "5 mission statuses" and "4 ticket statuses" but both counts are wrong. CASE.md and SPECKIT.md are authoritative: `MissionStatus` has **4** values (`pending`, `running`, `complete`, `failed`) and `TicketStatus` has **5** values (`pending_approval`, `approved`, `rejected`, `expired`, `cancelled`). Implement the correct counts per CASE.md — FR-002's counts are typos.

**File: `src/mcp.types.ts`**
- Interfaces: `QuoteOutput`, `OhlcvOutput`, `FundamentalsOutput`, `EarningsOutput`, `AnalystRatingsOutput`, `PriceTargetsOutput`
- Fields per SPECKIT.md and spec 004 Key Entities table

**File: `src/api.types.ts`**
- Interfaces: `AdminStatusResponse`, `ChatResponse`, `MissionResponse`
- `AdminStatusResponse`: agent states map, system health, today's cost aggregation
- `ChatResponse`: `{ missionId: string; response: string }`
- `MissionResponse`: mission + agent runs array

**File: `src/index.ts`**
- Re-exports everything from all 4 type files
- This is the single entry point for `@finsight/shared-types`

**Build**: `tsc` to `dist/`, `package.json` exports `./dist/index.js` with types at `./dist/index.d.ts`

---

### 3. Config YAML Files (11 files in `config/runtime/`)

Each YAML file contains production-ready defaults per CASE.md and spec 001 Configuration Details section.

**`agents.yaml`** — All 9 agents with `primary` (required) and `fallback` (optional) model configs. Structure per spec 001 lines 153–186. Also includes `confidence: { reDispatchOnLow: true }`.

**`pricing.yaml`** — Provider/model token rates. Structure per spec 001 lines 188–204. Includes `dailyBudgetUsd` and `alertThresholdPct`.

**`mcp.yaml`** — Per-server URLs, per-server timeouts, and per-tool cache TTLs (seconds). Keys are camelCase. Structure per CASE.md §6:
```yaml
servers:
  marketData:          { url: "http://market-data-mcp:3001",          timeoutMs: 5000, cache: { quoteTtlSec: 60, fundamentalsTtlSec: 3600, earningsTtlSec: 14400, ratingsTtlSec: 21600 } }
  macroSignals:        { url: "http://macro-signals-mcp:3002",        timeoutMs: 8000, cache: { gdeltTtlSec: 1800, ecoCalendarTtlSec: 14400, indicatorTtlSec: 86400 } }
  news:                { url: "http://news-mcp:3003",                  timeoutMs: 5000, cache: { latestTtlSec: 300, sentimentTtlSec: 900 } }
  ragRetrieval:        { url: "http://rag-retrieval-mcp:3004",        timeoutMs: 3000 }
  enterpriseConnector: { url: "http://enterprise-connector-mcp:3005", timeoutMs: 4000 }
  traderPlatform:      { url: "http://trader-platform-mcp:3006",      timeoutMs: 3000 }
```

**`scheduler.yaml`** — Cron + concurrency objects for all repeatable BullMQ jobs. Per CASE.md §6 plus `ticketExpiry` (spec 002 FR-014 requires it here):
```yaml
watchdogScan:  { cron: "*/30 * * * *", concurrency: 1 }   # every 30 min
screenerScan:  { cron: "0 7 * * 1-5",  concurrency: 1 }   # weekdays 07:00
dailyBrief:    { cron: "0 6 * * *",    concurrency: 1 }   # daily 06:00
earningsCheck: { cron: "30 7 * * 1-5", concurrency: 1 }   # weekdays 07:30
ticketExpiry:  { cron: "0 * * * *",    concurrency: 1 }   # every hour
```

**`watchdog.yaml`** — Per CASE.md §6:
```yaml
priceAlertThresholdPct: 2.0
volumeSpikeMultiplier: 2.5
earningsPreBriefDaysAhead: 3
newsLookbackMinutes: 30
```

**`screener.yaml`** — Per CASE.md §6:
```yaml
sectors: [semiconductors, ETFs, gold, energy]
minimumSignalScore: 0.6
topResultsPerRun: 3
```

**`rag.yaml`** — Merges CASE.md §6 fields with spec 004 RRF/threshold values:
```yaml
embeddingModel: text-embedding-3-small
embeddingDimensions: 1536
chunkSize: 512
chunkOverlap: 64
topK: 8
bm25Weight: 0.3
freshnessBoostDays: 7
rrfK: 60
maxThesisAgeHours: 24
```

**`trader.yaml`** — Per CASE.md §6:
```yaml
ticketExpiryHours: 24
minConfidenceToCreateTicket: medium
maxPendingTicketsPerUser: 5
mockExecutionSlippagePct: 0.05
allowedRoles: [admin, analyst]
requireTechnicianAlignment: false
platform: mock
```

**`auth.yaml`** — `accessTokenExpiryMinutes: 15`, `refreshTokenExpiryDays: 7`, `bcryptRounds: 12`. No secrets in YAML — `JWT_SECRET` lives in `.env` only (constitution §I, safety constraint).

**`telegram.yaml`** — `rateLimitPerUserPerMinute: 10`, command aliases.

**`app.yaml`** — Per CASE.md §6 (port and corsOrigins come from env vars, not YAML):
```yaml
logLevel: info
featureFlags:
  devilsAdvocate: true
  traderAgent: true
  screenerAgent: true
  hotConfigReload: true
```

---

### 4. Zod Schemas (`config/types/`)

Each file exports:
1. A Zod schema (e.g., `agentsConfigSchema`)
2. An inferred type (e.g., `type AgentsConfig = z.infer<typeof agentsConfigSchema>`)

**`config/types/index.ts`** — Re-exports all schemas and types. Exports the combined `AppConfig` type and `appConfigSchemas` map (`Record<string, z.ZodSchema>`) used by the config loader.

Key schema patterns:
- `AgentModelConfig` schema: `z.object({ provider: z.enum(['anthropic', 'openai', 'azure', 'lmstudio']), model: z.string(), temperature: z.number().min(0).max(2), maxTokens: z.number().int().positive() })`
- `AgentConfig` schema: `z.object({ primary: agentModelConfigSchema, fallback: agentModelConfigSchema.optional() })`
- Agents schema: 9 named agent keys, each `AgentConfig`, plus `confidence` settings
- Pricing schema: nested provider → model → rates, with `z.number().nonnegative()` for all rates
- Scheduler schema: cron string patterns for each job

---

### 5. Config Loader (`apps/api/src/lib/config.ts`)

**Exports**:
- `initConfig(): Promise<void>` — Reads all 11 YAML files from `config/runtime/`, validates each against its Zod schema, caches the merged result. Calls `process.exit(1)` with formatted Zod error on failure.
- `getConfig(): AppConfig` — Returns the cached config synchronously. Throws if called before `initConfig()`.
- `reloadConfig(): Promise<{ changed: string[] }>` — Re-reads and re-validates all files. On success, atomically swaps the cache and returns list of changed top-level keys. On validation failure, preserves existing config and throws.

**Implementation**:
```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { appConfigSchemas, type AppConfig } from '../../../../config/types/index.js';
```

- Logging: use `console.error` for config startup failures (the full Pino logger is spec 003 territory). Config loader must not depend on a logger that itself depends on config.
- Config directory path: resolved via `CONFIG_DIR` env var, defaulting to `../../config/runtime` relative to the API entry point.
- File loading: reads each YAML file, parses with `js-yaml`, validates with corresponding Zod schema.
- Error format on failure: `"Config validation failed in agents.yaml: manager.primary.provider — Required"` → `process.exit(1)`.
- The `reloadConfig()` function compares JSON-serialised top-level keys to detect changes.
- No chokidar watcher in this spec — hot-reload is triggered via `POST /admin/config/reload` (spec 003). The config loader just provides the `reloadConfig()` function.

---

### 6. Pricing Calculator (`apps/api/src/lib/pricing.ts`)

**Exports**:
- `computeCostUsd(provider: string, model: string, tokensIn: number, tokensOut: number): number`

**Logic**:
1. Read `getConfig().pricing.providers[provider][model]`
2. If provider is `'lmstudio'` → return `0` (local models are free)
3. If model not found → `console.warn` (never throw, never block)
4. Calculate: `(tokensIn / 1000 * inputPer1kTokens) + (tokensOut / 1000 * outputPer1kTokens)`
5. Round to 6 decimal places to avoid floating point noise

---

## Testing Strategy

### Unit Tests

**`packages/shared-types/src/__tests__/types.test.ts`**:
- Verify all const objects have expected number of values (9 agents, 8 mission types, etc.)
- Verify type narrowing works (e.g., `AgentName` union includes `'manager'`)
- Verify zero runtime dependencies (check package.json has no `dependencies` key)

**`apps/api/src/lib/__tests__/config.test.ts`**:
- `it('loads and validates all 11 YAML files successfully')` — uses real YAML fixtures
- `it('exits with code 1 when agents.yaml has missing primary.provider')` — mock `process.exit`, break a fixture
- `it('exits with code 1 when agents.yaml temperature is not a number')` — same pattern
- `it('getConfig returns cached value synchronously after init')`
- `it('reloadConfig returns changed keys when a file is modified')` — write to temp file, call reload, check returned keys
- `it('reloadConfig preserves existing config when new file is invalid')` — break a temp file, verify old config unchanged
- `it('throws if getConfig called before initConfig')`

Fixtures: copy real YAML files to a `__fixtures__/` directory. Tests point `CONFIG_DIR` to fixtures.

**`apps/api/src/lib/__tests__/pricing.test.ts`**:
- `it('returns 0 for lmstudio provider')`
- `it('correctly calculates anthropic/claude-sonnet cost')` — manual calculation comparison
- `it('returns 0 and logs warning for unknown model')` — spy on `console.warn`
- `it('returns 0 and logs warning for unknown provider')`
- `it('handles zero token counts')`

### Mocking

- `process.exit` — mocked in config tests to prevent test runner exit
- No external API calls in this spec — no msw needed
- File system: use real temp directories with fixture copies (more reliable than fs mocks)

### Test Commands

```bash
pnpm -r typecheck           # must pass with zero errors
pnpm -r test                # run all vitest suites
pnpm --filter @finsight/shared-types test
pnpm --filter @finsight/api test
```

---

## Complexity Tracking

### Estimated Effort
Moderate. Many files but each is straightforward. The 11 YAML files and 11 Zod schemas are repetitive by design. The config loader and pricing calculator are the only files with real logic.

### Risk Areas

1. **YAML content correctness** — The YAML values must match what downstream specs expect. The values in spec 001's Configuration Details section and CASE.md are the authority.
2. **Zod schema strictness** — Schemas must be strict enough to catch typos but not so strict they reject valid config. Use `.strict()` on objects to forbid extra keys.
3. **Path resolution** — `CONFIG_DIR` must resolve correctly in both dev (running from source) and Docker (mounted at `/app/config/runtime`). Default path should work for both.

### Open Questions

None — all decisions are settled in the spec and CASE.md.
