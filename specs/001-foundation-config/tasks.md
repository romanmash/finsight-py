# Tasks: Foundation & Config System

**Branch**: `001-foundation-config`
**Input**: Design documents from `specs/001-foundation-config/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories)

---

## Format: `[ID] [P?] [Story?] Description with file path`

- `[P]` = parallelizable (no dependency on incomplete sibling tasks)
- `[US#]` = user story label (required for Phase 3+ tasks only)
- Tasks without `[US#]` are Setup, Foundational, or Polish phase tasks

---

## Phase 1: Setup

*Monorepo root initialization — shared by all workspace packages. No story label.*

- [ ] T001 Create `pnpm-workspace.yaml` with `packages/*` and `apps/*` workspace patterns
- [ ] T002 Create root `package.json` with workspace scripts (`typecheck`, `lint`, `test`, `build`), `engines: { node: ">=20" }`, and devDeps: `typescript ~5.8.0`, `@types/node ^20`, `vitest ^3.1.0`, `eslint ^9.0.0`, `@typescript-eslint/parser ^8.0.0`, `@typescript-eslint/eslint-plugin ^8.0.0`
- [ ] T003 Create root `tsconfig.base.json` — `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `target: "ES2022"`, `module: "Node16"`, `moduleResolution: "Node16"`
- [ ] T004 Create root `eslint.config.js` — ESLint 9 flat config with `@typescript-eslint` rules, `no-explicit-any: error`, `explicit-function-return-type: error`, applied to all `**/*.ts`
- [ ] T005 Create `.npmrc` — `link-workspace-packages=true`, `prefer-workspace-packages=true`

---

## Phase 2: Foundational

*API app scaffold — blocking prerequisite for all API-related user stories (US3, US4, US5). No story label.*

- [ ] T006 Create `apps/api/package.json` — `name: "@finsight/api"`, scripts (`typecheck: tsc --noEmit`, `test: vitest run`, `lint: eslint src --max-warnings 0`), deps: `js-yaml ^4.1.0`, `zod ^3.24.0`, `@finsight/shared-types workspace:*`, devDeps: `@types/js-yaml ^4.0.0`, `typescript ~5.8.0`, `vitest ^3.1.0`
- [ ] T007 Create `apps/api/tsconfig.json` — extends `../../tsconfig.base.json`, `include` covers `src/**/*` and `../../config/types/**/*`, `outDir: "dist"`
- [ ] T008 Run `pnpm install` from repo root — verify workspace resolution succeeds and `@finsight/shared-types` is linked

---

## Phase 3: User Story 1 — Monorepo & Shared Types (P1)

*Goal: All domain types defined once, importable across the codebase with full IntelliSense.*
*Independent test: `pnpm -r typecheck` passes with zero errors; import `AgentName`, `MissionType` from `@finsight/shared-types` and verify types resolve.*

- [ ] T009 [P] [US1] Create `packages/shared-types/package.json` — `name: "@finsight/shared-types"`, scripts (`typecheck: tsc --noEmit`, `build: tsc`, `lint: eslint src --max-warnings 0`), zero runtime `dependencies`, exports `./dist/index.js` with types at `./dist/index.d.ts`
- [ ] T010 [P] [US1] Create `packages/shared-types/tsconfig.json` — extends `../../tsconfig.base.json`, `rootDir: "src"`, `outDir: "dist"`, `declaration: true`
- [ ] T011 [US1] Create `packages/shared-types/src/agents.types.ts` — const objects: `AgentName` (9 values), `AgentState` (4), `Provider` (4), `Confidence` (3), `AnalystMode` (3); interfaces with JSDoc: `AgentModelConfig`, `AgentConfig`, `ResearchOutput`, `AnalystOutput`, `TechnicianOutput`, `BookkeeperInput`, `KbEntrySnippet`
- [ ] T012 [US1] Create `packages/shared-types/src/missions.types.ts` — const objects: `MissionType` (8), `MissionStatus` (4: pending/running/complete/failed), `MissionTrigger` (5), `AlertType` (7), `AlertSeverity` (3), `ChangeType` (4), `TicketStatus` (5: pending_approval/approved/rejected/expired/cancelled), `UserRole` (3)
- [ ] T013 [P] [US1] Create `packages/shared-types/src/mcp.types.ts` — interfaces with JSDoc: `QuoteOutput`, `OhlcvOutput`, `FundamentalsOutput`, `EarningsOutput`, `AnalystRatingsOutput`, `PriceTargetsOutput`
- [ ] T014 [P] [US1] Create `packages/shared-types/src/api.types.ts` — interfaces with JSDoc: `AdminStatusResponse`, `ChatResponse`, `MissionResponse`
- [ ] T015 [US1] Create `packages/shared-types/src/index.ts` — re-export everything from all 4 type files
- [ ] T016 [US1] Create `packages/shared-types/src/__tests__/types.test.ts` — verify const object value counts (9 agents, 8 mission types, 4 statuses, 5 ticket statuses, etc.); verify `@finsight/shared-types` `package.json` has no `dependencies` key
- [ ] T017 [US1] Run `pnpm -r typecheck` — verify zero errors across all packages

---

## Phase 4: User Story 2 — Configuration YAML Files (P1)

*Goal: All system behavior configurable via YAML without code changes.*
*Independent test: Modify a value in any `config/runtime/*.yaml`, verify system reads it on reload.*

- [ ] T018 [P] [US2] Create `config/runtime/agents.yaml` — all 9 agents (manager, watchdog, screener, researcher, analyst, technician, bookkeeper, reporter, trader) with `primary` + optional `fallback` model configs per spec.md lines 153–186; include `confidence: { reDispatchOnLow: true }`
- [ ] T019 [P] [US2] Create `config/runtime/pricing.yaml` — provider/model token rates per spec.md lines 188–204; include `dailyBudgetUsd: 5.00`, `alertThresholdPct: 80`
- [ ] T020 [P] [US2] Create `config/runtime/mcp.yaml` — 6 MCP servers (marketData, macroSignals, news, ragRetrieval, enterpriseConnector, traderPlatform) with URL, timeoutMs, and per-server cache TTLs per plan.md §3
- [ ] T021 [P] [US2] Create `config/runtime/scheduler.yaml` — 5 jobs: `watchdogScan`, `screenerScan`, `dailyBrief`, `earningsCheck`, `ticketExpiry` with cron expressions and `concurrency: 1`
- [ ] T022 [P] [US2] Create `config/runtime/watchdog.yaml` — `priceAlertThresholdPct: 2.0`, `volumeSpikeMultiplier: 2.5`, `earningsPreBriefDaysAhead: 3`, `newsLookbackMinutes: 30`
- [ ] T023 [P] [US2] Create `config/runtime/screener.yaml` — `sectors`, `minimumSignalScore: 0.6`, `topResultsPerRun: 3`
- [ ] T024 [P] [US2] Create `config/runtime/rag.yaml` — `embeddingModel`, `embeddingDimensions: 1536`, `chunkSize: 512`, `chunkOverlap: 64`, `topK: 8`, `bm25Weight: 0.3`, `freshnessBoostDays: 7`, `rrfK: 60`, `maxThesisAgeHours: 24`
- [ ] T025 [P] [US2] Create `config/runtime/trader.yaml` — `ticketExpiryHours: 24`, `minConfidenceToCreateTicket: medium`, `maxPendingTicketsPerUser: 5`, `mockExecutionSlippagePct: 0.05`, `allowedRoles`, `requireTechnicianAlignment: false`, `platform: mock`
- [ ] T026 [P] [US2] Create `config/runtime/auth.yaml` — `accessTokenExpiryMinutes: 15`, `refreshTokenExpiryDays: 7`, `bcryptRounds: 12` (no secrets — `JWT_SECRET` lives in `.env` only)
- [ ] T027 [P] [US2] Create `config/runtime/telegram.yaml` — `rateLimitPerUserPerMinute: 10`, command aliases map
- [ ] T028 [P] [US2] Create `config/runtime/app.yaml` — `logLevel: info`, `featureFlags: { devilsAdvocate: true, traderAgent: true, screenerAgent: true, hotConfigReload: true }`

---

## Phase 5: User Story 3 — Config Loader with Validation (P1)

*Goal: Any invalid YAML field causes `process.exit(1)` at startup with the exact field path.*
*Independent test: Break `agents.yaml` by removing `manager.primary.provider`; start API; verify exit code 1 and error message contains `"agents.manager.primary.provider"`.*

- [ ] T029 [P] [US3] Create `config/types/agents.schema.ts` — Zod schema for `agents.yaml`; `AgentModelConfig` schema with enum for provider, `AgentConfig` with optional fallback; 9 named agent keys; `confidence` settings
- [ ] T030 [P] [US3] Create `config/types/pricing.schema.ts` — nested provider → model → `{ inputPer1kTokens, outputPer1kTokens }` with `z.number().nonnegative()`; `dailyBudgetUsd`, `alertThresholdPct`
- [ ] T031 [P] [US3] Create `config/types/mcp.schema.ts` — 6 server entries with `url`, `timeoutMs`, optional nested `cache` TTL fields per server
- [ ] T032 [P] [US3] Create `config/types/scheduler.schema.ts` — 5 job keys each with `cron: z.string()` and `concurrency: z.number().int().positive()`
- [ ] T033 [P] [US3] Create `config/types/watchdog.schema.ts`
- [ ] T034 [P] [US3] Create `config/types/screener.schema.ts`
- [ ] T035 [P] [US3] Create `config/types/rag.schema.ts`
- [ ] T036 [P] [US3] Create `config/types/trader.schema.ts`
- [ ] T037 [P] [US3] Create `config/types/auth.schema.ts`
- [ ] T038 [P] [US3] Create `config/types/telegram.schema.ts`
- [ ] T039 [P] [US3] Create `config/types/app.schema.ts`
- [ ] T040 [US3] Create `config/types/index.ts` — re-export all 11 schemas and inferred types; export combined `AppConfig` type and `appConfigSchemas: Record<string, z.ZodSchema>` map used by the config loader
- [ ] T041 [US3] Create `apps/api/src/lib/config.ts` — export `initConfig(): Promise<void>` (reads all 11 YAML files via `CONFIG_DIR` env var, validates with Zod schemas, caches result, calls `process.exit(1)` with field path on failure); `getConfig(): AppConfig` (synchronous, throws if called before init); `reloadConfig(): Promise<{ changed: string[] }>` (re-parses all files, atomic swap on success, preserves existing config on validation failure)
- [ ] T042 [US3] Create `apps/api/src/lib/__tests__/config.test.ts` with fixtures in `__fixtures__/` — 5 test cases: loads all 11 valid YAML files; exits code 1 when `agents.yaml` missing `manager.primary.provider`; exits code 1 when `agents.yaml` has `temperature: "hot"` (wrong type); `getConfig()` returns cached value synchronously; throws `Error` if `getConfig()` called before `initConfig()`
- [ ] T043 [US3] Run `pnpm --filter @finsight/api test` — verify 5 config tests pass

---

## Phase 6: User Story 4 — Config Hot-Reload (P2)

*Goal: `reloadConfig()` updates running config atomically and returns changed keys.*
*Independent test: Call `reloadConfig()` after modifying a fixture file; verify `{ changed: ['watchdog'] }` is returned.*
*Depends on: US3 (config.ts already contains `reloadConfig()` implementation)*

- [ ] T044 [US4] Extend `apps/api/src/lib/__tests__/config.test.ts` with 2 additional test cases: `reloadConfig()` writes to a temp fixture, calls reload, verifies returned `changed` array contains the modified key; `reloadConfig()` with invalid YAML preserves existing `getConfig()` values and throws
- [ ] T045 [US4] Run `pnpm --filter @finsight/api test` — verify all 7 config tests pass (5 from US3 + 2 new)

---

## Phase 7: User Story 5 — Pricing Calculator (P2)

*Goal: Accurate per-call cost from `pricing.yaml` rates; unknown/local models return 0.*
*Independent test: Call `computeCostUsd('openai', 'gpt-4o', 1000, 500)` and verify result matches manual calculation from pricing.yaml.*

- [ ] T046 [US5] Create `apps/api/src/lib/pricing.ts` — export `computeCostUsd(provider: string, model: string, tokensIn: number, tokensOut: number): number`; returns 0 for `lmstudio`; returns 0 + `console.warn` for unknown model; calculates `(tokensIn / 1000 * inputPer1kTokens) + (tokensOut / 1000 * outputPer1kTokens)` rounded to 6 decimal places
- [ ] T047 [US5] Create `apps/api/src/lib/__tests__/pricing.test.ts` — 5 test cases: returns 0 for lmstudio; correct value for anthropic/claude-sonnet; returns 0 + warns for unknown model; returns 0 + warns for unknown provider; handles zero token counts
- [ ] T048 [US5] Run `pnpm --filter @finsight/api test` — verify all pricing tests pass

---

## Final Phase: Polish & Cross-Cutting Concerns

*Verification gate — all stories must be complete before this phase.*

- [ ] T049 Run `pnpm -r typecheck` — zero errors across all packages
- [ ] T050 Run `pnpm -r test` — all tests pass (shared-types + api)
- [ ] T051 Verify `packages/shared-types/package.json` has no `dependencies` key (zero runtime deps — FR-006)
- [ ] T052 Verify all 11 `config/runtime/*.yaml` files are present and parseable
- [ ] T053 Run `pnpm -r lint` — zero warnings

---

## Dependencies & Execution Order

```
T001–T005 (Setup)
    ↓
T006–T008 (Foundational — API scaffold + pnpm install)
    ↓
T009–T017 (US1 — shared-types; parallelizable within phase)
    ↓
T018–T028 (US2 — YAML files; fully parallelizable)
    ↓
T029–T043 (US3 — Zod schemas + config loader; schemas parallelizable)
    ↓
T044–T045 (US4 — hot-reload tests; extends US3 config.ts)
    ↓
T046–T048 (US5 — pricing; independent once US3 config is available)
    ↓
T049–T053 (Polish — final verification)
```

## Parallel Opportunities

- **T009–T010**: shared-types package.json and tsconfig.json
- **T011–T014**: all four type files (agents, missions, mcp, api)
- **T018–T028**: all 11 YAML files are fully independent
- **T029–T039**: all 11 Zod schema files are fully independent

## Implementation Strategy

**MVP scope (US1 + US2 + US3)**: Complete P1 stories first. This gives a fully functional foundation with type safety and validated config. US4 and US5 are P2 enhancements.

**Recommended sequence**: T001 → T008 (setup) → T009–T017 (US1) → T018–T028 (US2, all in parallel) → T029–T043 (US3, schemas in parallel then loader) → T044–T048 (US4, US5) → T049–T053 (verification).
