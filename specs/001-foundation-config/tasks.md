# Tasks: Foundation & Config System

**Feature**: `001-foundation-config`
**Plan**: [`plan.md`](./plan.md)

---

## User Story 1 — Monorepo & Shared Types (P1)

- [ ] Create root `pnpm-workspace.yaml` with `packages/*`, `apps/*` patterns
- [ ] Create root `package.json` with workspace scripts (`typecheck`, `lint`, `test`, `build`) and ESLint + TypeScript devDeps
- [ ] Create root `tsconfig.base.json` with strict settings (shared by all packages)
- [ ] Create root `eslint.config.js` — ESLint 9 flat config, `no-explicit-any: error`, `explicit-function-return-type: error`
- [ ] Create `.npmrc` with workspace linking preferences
- [ ] Create `packages/shared-types/package.json` — `name: "@finsight/shared-types"`, scripts (`typecheck: tsc --noEmit`, `build: tsc`, `lint: eslint src --max-warnings 0`), zero runtime deps, exports `./dist/index.js`
- [ ] Create `packages/shared-types/tsconfig.json` (extends base, `outDir: "dist"`)
- [ ] Create `packages/shared-types/src/agents.types.ts` — `AgentName`, `AgentState`, `Provider`, `Confidence`, `AnalystMode` const objects + `AgentModelConfig`, `AgentConfig`, `ResearchOutput`, `AnalystOutput`, `TechnicianOutput`, `BookkeeperInput`, `KbEntrySnippet` interfaces
- [ ] Create `packages/shared-types/src/missions.types.ts` — `MissionType`, `MissionStatus`, `MissionTrigger`, `AlertType`, `AlertSeverity`, `ChangeType`, `TicketStatus`, `UserRole` const objects
- [ ] Create `packages/shared-types/src/mcp.types.ts` — `QuoteOutput`, `OhlcvOutput`, `FundamentalsOutput`, `EarningsOutput`, `AnalystRatingsOutput`, `PriceTargetsOutput` interfaces
- [ ] Create `packages/shared-types/src/api.types.ts` — `AdminStatusResponse`, `ChatResponse`, `MissionResponse` interfaces
- [ ] Create `packages/shared-types/src/index.ts` — re-export all types
- [ ] Create `packages/shared-types/src/__tests__/types.test.ts` — verify const object value counts and zero runtime deps
- [ ] Verify: `pnpm -r typecheck` passes with zero errors

## User Story 2 — Configuration YAML Files (P1)

- [ ] Create `config/runtime/agents.yaml` — all 9 agents with primary/fallback model configs per spec
- [ ] Create `config/runtime/pricing.yaml` — provider/model token rates, budget, alert threshold
- [ ] Create `config/runtime/mcp.yaml` — 6 server URLs/ports, cache TTLs, timeout
- [ ] Create `config/runtime/scheduler.yaml` — cron expressions for 5 repeatable jobs
- [ ] Create `config/runtime/watchdog.yaml` — price/volume/news/macro thresholds
- [ ] Create `config/runtime/screener.yaml` — sectors, top-N, scoring weights
- [ ] Create `config/runtime/rag.yaml` — bm25Weight, RRF k, defaultLimit, maxThesisAgeHours
- [ ] Create `config/runtime/trader.yaml` — platform mode, slippage, ticket expiry
- [ ] Create `config/runtime/auth.yaml` — token TTLs, bcrypt rounds (secret from env)
- [ ] Create `config/runtime/telegram.yaml` — rate limit, command aliases
- [ ] Create `config/runtime/app.yaml` — port, logLevel, corsOrigins

## User Story 3 — Config Loader with Validation (P1)

- [ ] Create `config/types/agents.schema.ts` — Zod schema for agents.yaml
- [ ] Create `config/types/pricing.schema.ts` — Zod schema for pricing.yaml
- [ ] Create `config/types/mcp.schema.ts` — Zod schema for mcp.yaml
- [ ] Create `config/types/scheduler.schema.ts` — Zod schema for scheduler.yaml
- [ ] Create `config/types/watchdog.schema.ts` — Zod schema for watchdog.yaml
- [ ] Create `config/types/screener.schema.ts` — Zod schema for screener.yaml
- [ ] Create `config/types/rag.schema.ts` — Zod schema for rag.yaml
- [ ] Create `config/types/trader.schema.ts` — Zod schema for trader.yaml
- [ ] Create `config/types/auth.schema.ts` — Zod schema for auth.yaml
- [ ] Create `config/types/telegram.schema.ts` — Zod schema for telegram.yaml
- [ ] Create `config/types/app.schema.ts` — Zod schema for app.yaml
- [ ] Create `config/types/index.ts` — re-export all schemas, export `AppConfig` type and `appConfigSchemas` map
- [ ] Create `apps/api/package.json` — `name: "@finsight/api"`, scripts (`typecheck`, `test`, `lint`), deps: `js-yaml`, `zod`, `@finsight/shared-types`
- [ ] Create `apps/api/tsconfig.json` (extends base, `include` covers `src` and `../../config/types`)
- [ ] Create `apps/api/src/lib/config.ts` — `initConfig()`, `getConfig()`, `reloadConfig()`
- [ ] Create `apps/api/src/lib/__tests__/config.test.ts` — 7 test cases per plan
- [ ] Verify: `initConfig()` succeeds with valid YAML; `process.exit(1)` on broken YAML

## User Story 5 — Pricing Calculator (P2)

- [ ] Create `apps/api/src/lib/pricing.ts` — `computeCostUsd()` function
- [ ] Create `apps/api/src/lib/__tests__/pricing.test.ts` — 5 test cases per plan
- [ ] Verify: lmstudio returns 0, unknown model returns 0 + warning, known model returns correct value

## Final Verification

- [ ] `pnpm install` succeeds
- [ ] `pnpm -r typecheck` — zero errors
- [ ] `pnpm -r test` — all tests pass
- [ ] All 11 YAML files parse without error
- [ ] `@finsight/shared-types` has zero runtime dependencies
