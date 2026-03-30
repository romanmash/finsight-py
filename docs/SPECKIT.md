# SPECKIT.md — FinSight AI Hub
### Implementation Briefs for Codex / Claude Code

**Version:** 1.0
**Status:** ⚠️ **Superseded for implementation workflow.** The canonical implementation artifacts are `specs/001–011/` (each with `spec.md`, `plan.md`, `tasks.md`). Use the `/plan` and `/implement` slash commands, not this document, to drive implementation. **This document remains valuable as a detailed TypeScript interface and test-case reference when authoring `plan.md` files.**

**Read first:** CASE.md (full specification) · CONTEXT.md (environment, decisions, constraints)
**Purpose:** Each spec below is a self-contained implementation brief for one component. TypeScript interfaces, test cases, and implementation notes in this document are the most detailed source available for plan.md authors.

---

## How to Use This Document

Each spec follows the same structure:

- **Scope** — exactly what to build, what NOT to build
- **Files** — every file to create or modify, with full paths
- **Inputs / Outputs** — types, interfaces, contracts
- **Implementation notes** — how to build it, key decisions
- **Acceptance criteria** — how to verify it works
- **Tests required** — specific test cases

Specs reference each other. When a spec says "uses `AgentConfig` from shared-types", that type is defined in **Spec 1**.

---

## Spec 1 — Monorepo Foundation + Shared Types

### Scope
Bootstrap the pnpm workspace. Create the `packages/shared-types` package with all domain types and const enums. This is the dependency-free foundation everything else imports from.

### Files to create

```
pnpm-workspace.yaml
package.json                          # root — scripts: build, typecheck, lint, test
packages/shared-types/package.json
packages/shared-types/tsconfig.json
packages/shared-types/src/agents.types.ts
packages/shared-types/src/missions.types.ts
packages/shared-types/src/mcp.types.ts
packages/shared-types/src/api.types.ts
packages/shared-types/src/index.ts
```

### Content of `agents.types.ts`

```typescript
export const AgentName = {
  MANAGER: 'manager',
  WATCHDOG: 'watchdog',
  SCREENER: 'screener',
  RESEARCHER: 'researcher',
  ANALYST: 'analyst',
  TECHNICIAN: 'technician',
  BOOKKEEPER: 'bookkeeper',
  REPORTER: 'reporter',
  TRADER: 'trader',
} as const;
export type AgentName = typeof AgentName[keyof typeof AgentName];

export const AgentState = {
  ACTIVE: 'active',
  QUEUED: 'queued',
  IDLE: 'idle',
  ERROR: 'error',
} as const;
export type AgentState = typeof AgentState[keyof typeof AgentState];

export const Provider = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  AZURE: 'azure',
  LMSTUDIO: 'lmstudio',
} as const;
export type Provider = typeof Provider[keyof typeof Provider];

export interface AgentModelConfig {
  provider: Provider;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AgentConfig {
  primary: AgentModelConfig;
  fallback?: AgentModelConfig;
  devilAdvocateTemperature?: number; // Analyst only
}

export interface ResearchOutput {
  ticker: string;
  focusQuestions: string[];
  ohlcvSummary: { recentTrend: string; keyPricePoints: Record<string, number> };
  fundamentals: Record<string, unknown>;
  analystRatings: { consensus: string; avgTarget: number; breakdown: Record<string, number> } | null;
  newsItems: Array<{ headline: string; sentiment: string; datetime: number }>;
  sentimentSummary: { avgScore: number; trend: string };
  gdeltRiskScore: number;
  existingKbContext: KbEntrySnippet[];
  internalDocs: Array<{ title: string; snippet: string }>;
  confidence: Confidence;
  confidenceReason: string;
}

export interface KbEntrySnippet {
  id: string;
  content: string;
  ticker: string | null;
  entryType: string;
  similarityScore: number;
  contradictionFlag: boolean;
}

export interface AnalystOutput {
  ticker: string | string[];
  mode: AnalystMode;
  thesisUpdate: string;
  supportingEvidence: string[];
  riskFactors: string[];
  contradictions: string[];
  sentimentDelta: 'improved' | 'deteriorated' | 'unchanged';
  comparisonTable?: Record<string, unknown>;
  confidence: Confidence;
  confidenceReason: string;
}

export interface TechnicianOutput {
  ticker: string;
  periodWeeks: number;
  trend: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  keyLevels: { support: number; resistance: number };
  indicators: {
    rsi: { value: number; signal: 'overbought' | 'oversold' | 'neutral' };
    macd: { signal: 'bullish_crossover' | 'bearish_crossover' | 'neutral' };
    bollingerPosition: 'upper' | 'middle' | 'lower' | 'outside_upper' | 'outside_lower';
    volumeSpike: boolean;
  };
  patterns: string[];
  summary: string;
  confidence: Confidence;
  confidenceReason: string;
}

export interface BookkeeperInput {
  analystOutput: AnalystOutput;
  technicianOutput?: TechnicianOutput;
  missionId: string;
  userId: string;
}

export const Confidence = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
export type Confidence = typeof Confidence[keyof typeof Confidence];

export const AnalystMode = {
  STANDARD: 'standard',
  DEVIL_ADVOCATE: 'devil_advocate',
  COMPARISON: 'comparison',
} as const;
export type AnalystMode = typeof AnalystMode[keyof typeof AnalystMode];
```

### Content of `missions.types.ts`

```typescript
export const MissionType = {
  OPERATOR_QUERY: 'operator_query',
  ALERT_INVESTIGATION: 'alert_investigation',
  COMPARISON: 'comparison',
  DEVIL_ADVOCATE: 'devil_advocate',
  PATTERN_REQUEST: 'pattern_request',
  EARNINGS_PREBRIEF: 'earnings_prebrief',
  TRADE_REQUEST: 'trade_request',
  DAILY_BRIEF: 'daily_brief',
} as const;
export type MissionType = typeof MissionType[keyof typeof MissionType];

export const MissionStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETE: 'complete',
  FAILED: 'failed',
} as const;
export type MissionStatus = typeof MissionStatus[keyof typeof MissionStatus];

export const MissionTrigger = {
  TELEGRAM: 'telegram',
  WATCHDOG: 'watchdog',
  SCHEDULED: 'scheduled',
  KB_FAST_PATH: 'kb_fast_path',
  MANUAL: 'manual',
} as const;
export type MissionTrigger = typeof MissionTrigger[keyof typeof MissionTrigger];

export const AlertType = {
  PRICE_SPIKE: 'price_spike',
  VOLUME_SPIKE: 'volume_spike',
  NEWS_EVENT: 'news_event',
  MACRO_RISK: 'macro_risk',
  THESIS_CONTRADICTION: 'thesis_contradiction',
  EARNINGS_APPROACHING: 'earnings_approaching',
  PATTERN_SIGNAL: 'pattern_signal',
} as const;
export type AlertType = typeof AlertType[keyof typeof AlertType];

export const AlertSeverity = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
export type AlertSeverity = typeof AlertSeverity[keyof typeof AlertSeverity];

export const ChangeType = {
  INITIAL: 'initial',
  UPDATE: 'update',
  CONTRADICTION: 'contradiction',
  DEVIL_ADVOCATE: 'devil_advocate',
} as const;
export type ChangeType = typeof ChangeType[keyof typeof ChangeType];

export const TicketStatus = {
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;
export type TicketStatus = typeof TicketStatus[keyof typeof TicketStatus];

export const UserRole = {
  ADMIN: 'admin',
  ANALYST: 'analyst',
  VIEWER: 'viewer',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];
```

### Acceptance criteria
- `pnpm -r typecheck` passes with zero errors
- `packages/shared-types` builds to `dist/` cleanly
- All types are importable from `@finsight/shared-types`
- Zero runtime dependencies in `packages/shared-types/package.json`

---

## Spec 2 — Config Loader + All YAML Files

### Scope
Create all `config/runtime/*.yaml` files and `config/types/*.schema.ts` Zod schemas. Create `lib/config-loader.ts` which loads, validates, and hot-reloads all config. This is the second thing that must exist — every other module depends on it.

### Files to create

```
config/runtime/agents.yaml         # full content in CASE.md §6
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

apps/api/src/lib/config-loader.ts
apps/api/src/lib/pricing.ts
```

### `config-loader.ts` interface

```typescript
import type { AppConfig } from './config-loader.types';

// Loaded once at startup, validated, then cached
export function getConfig(): AppConfig;

// Called by POST /admin/config/reload and chokidar watcher
export async function reloadConfig(): Promise<{ changed: string[] }>;

// Returns diff of changed top-level keys since last load
export function getConfigDiff(): string[];

// Call at app startup — throws on validation failure (process.exit(1))
export async function initConfig(): Promise<void>;
```

### `AppConfig` type (returned by `getConfig()`)

```typescript
export interface AppConfig {
  agents: AgentsConfig;      // from agents.schema.ts
  pricing: PricingConfig;
  mcp: McpConfig;
  scheduler: SchedulerConfig;
  watchdog: WatchdogConfig;
  screener: ScreenerConfig;
  rag: RagConfig;
  trader: TraderConfig;
  auth: AuthConfig;
  telegram: TelegramConfig;
  app: AppRuntimeConfig;
}
```

### Implementation notes

- Use `js-yaml` to parse YAML files
- Use `zod` to validate each config section against its schema
- On validation failure: log the exact Zod error with field path → `process.exit(1)`
- Use `chokidar` to watch `config/runtime/` directory for changes
- On file change: re-parse and re-validate that file's config only → merge into cached config → call all registered reload listeners
- `getConfig()` must be synchronous (returns cached value) — never read files on every call
- Config is mounted read-only (`:ro`) in Docker — chokidar still works for hot-reload via `POST /admin/config/reload`

### `pricing.ts` interface

```typescript
// Compute USD cost from token counts and provider/model
export function computeCostUsd(
  provider: Provider,
  model: string,
  tokensIn: number,
  tokensOut: number
): number;
```

### Acceptance criteria
- `initConfig()` succeeds with valid YAML files
- `initConfig()` calls `process.exit(1)` with descriptive error when any field is missing or wrong type
- `reloadConfig()` returns `{ changed: ['agents', 'watchdog'] }` when those files are modified
- `computeCostUsd('anthropic', 'claude-sonnet-4-5', 1000, 500)` returns correct value per pricing.yaml

### Tests required

```typescript
// Unit tests — config-loader.test.ts
it('loads and validates all YAML files successfully')
it('exits with code 1 when agents.yaml has missing primary.provider')
it('exits with code 1 when agents.yaml temperature is not a number')
it('reloadConfig returns changed keys when a file is modified')
it('getConfig returns updated values after reload')

// Unit tests — pricing.test.ts
it('computeCostUsd returns 0 for lmstudio provider')
it('computeCostUsd correctly calculates anthropic/claude-sonnet-4-5 cost')
it('computeCostUsd returns 0 for unknown model (no silent failure)')
```

---

## Spec 3 — Prisma Schema + Database Setup

### Scope
Create the Prisma schema (full schema from CASE.md §12), run the initial migration, create `lib/db.ts` singleton, and create `lib/redis.ts` with BullMQ queue definitions.

### Files to create

```
apps/api/prisma/schema.prisma       # full schema from CASE.md §12
apps/api/src/lib/db.ts
apps/api/src/lib/redis.ts
apps/api/src/lib/queues.ts          # BullMQ queue definitions
docker-compose.yml                  # 12 containers — see CONTEXT.md §4
docker-compose.dev.yml              # dev overrides: exposed ports, volume mounts
```

### `lib/db.ts`

```typescript
import { PrismaClient } from '@prisma/client';

// Singleton — one connection for the process
// Uses DATABASE_URL from environment
export const db: PrismaClient;
```

### `lib/redis.ts`

```typescript
import { Redis } from 'ioredis';

// Singleton Redis connection (REDIS_URL from env)
export const redis: Redis;

// Redis key helpers
export const RedisKey = {
  agentState: (name: AgentName) => `agent:state:${name}`,
  mcpCache: (server: string, tool: string, hash: string) => `mcp:${server}:${tool}:${hash}`,
} as const;
```

### `lib/queues.ts` — BullMQ named queues

```typescript
import { Queue } from 'bullmq';

export const watchdogScanQueue: Queue;    // repeatable, cron from scheduler.yaml
export const screenerScanQueue: Queue;    // repeatable, cron from scheduler.yaml
export const dailyBriefQueue: Queue;      // repeatable, cron from scheduler.yaml
export const earningsCheckQueue: Queue;   // repeatable, cron from scheduler.yaml
export const ticketExpiryQueue: Queue;    // repeatable, every hour
export const alertPipelineQueue: Queue;   // standard — pushed by Watchdog
```

### `docker-compose.yml` key requirements
- 12 services as documented in CONTEXT.md §4
- `config/runtime` mounted `:ro` into every service at `/app/config/runtime`
- postgres: `postgres:16` image with `POSTGRES_DB=finsight`
- postgres: enable pgvector via `init.sql` or startup script
- redis: `redis:7-alpine`
- All app containers: `restart: unless-stopped`
- All app containers: environment variables from `.env` file
- Health checks on postgres, redis, and all 6 MCP servers

### Acceptance criteria
- `docker compose up -d postgres redis` starts cleanly
- `pnpm prisma migrate dev --name init` creates all tables
- `db.user.findMany()` returns an empty array without error
- `redis.ping()` returns `PONG`
- All 6 BullMQ queues can be instantiated without error

---

## Spec 4 — Hono API: Auth + Middleware + Admin

### Scope
Create the Hono app entry point, all middleware, auth routes (`/auth/*`), and admin routes (`/admin/*`) including `GET /api/admin/status`. Does NOT include agent routes or chat — those come later.

### Files to create

```
apps/api/src/index.ts
apps/api/src/lib/jwt.ts
apps/api/src/lib/password.ts
apps/api/src/lib/middleware/request-id.ts
apps/api/src/lib/middleware/logger.ts
apps/api/src/lib/middleware/auth.ts
apps/api/src/lib/middleware/role-guard.ts
apps/api/src/lib/middleware/rate-limit.ts
apps/api/src/routes/auth.ts
apps/api/src/routes/admin.ts
```

### Middleware chain (order matters)

```typescript
// apps/api/src/index.ts
app.use(requestId());          // adds x-request-id header + ctx.var.requestId
app.use(logger());             // Pino structured JSON, includes requestId
app.use('/api/*', auth());     // validates JWT, attaches ctx.var.user
app.use('/admin/*', auth());   // same — admin routes also need JWT
app.use('/admin/*', roleGuard('admin'));  // admin-only
app.use('/api/*', rateLimiter());        // Redis-backed, configurable
app.use(langsmithInject());    // attaches LangSmith run context
```

### `lib/jwt.ts`

```typescript
export interface JwtPayload {
  sub: string;        // userId
  role: UserRole;
  iat: number;
  exp: number;
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string;
export function signRefreshToken(userId: string): string;
export function verifyAccessToken(token: string): JwtPayload;  // throws on invalid
export function verifyRefreshToken(token: string): { userId: string };
```

### Auth routes

```
POST /auth/login     { email, password } → { accessToken, refreshToken, user }
POST /auth/refresh   { refreshToken }    → { accessToken }
POST /auth/logout    { refreshToken }    → 204
GET  /me             JWT required        → { id, email, name, role, telegramHandle }
```

### Admin routes

```
GET  /api/admin/status          → AdminStatusResponse (see CASE.md §5.4)
POST /admin/users               { email, password, name, role, telegramHandle? } → User
GET  /admin/users               → User[]
PATCH /admin/users/:id          { active?, role? } → User
GET  /admin/config              → current loaded config (all YAML merged)
POST /admin/config/reload       → { changed: string[] }
POST /api/watchdog/trigger      → 202 Accepted
POST /api/screener/trigger      → 202 Accepted
```

### `GET /api/admin/status` implementation

```typescript
// 1. Read all 9 agent state Redis keys via MGET (one round trip)
const stateKeys = Object.values(AgentName).map(n => RedisKey.agentState(n));
const rawStates = await redis.mget(...stateKeys);

// 2. Aggregate today's costs from AgentRun (cached in Redis for 30s)
const cacheKey = `admin:spend:${today}`;
let spend = await redis.get(cacheKey);
if (!spend) {
  spend = await db.agentRun.groupBy({
    by: ['provider'],
    where: { createdAt: { gte: startOfDay } },
    _sum: { costUsd: true },
  });
  await redis.set(cacheKey, JSON.stringify(spend), 'EX', 30);
}

// 3. Get active mission (running status) from DB
const activeMission = await db.mission.findFirst({
  where: { status: 'running' },
  include: { agentRuns: true },
});

// 4. Get mission log (last 10 complete/failed)
// 5. Check service health (ping each MCP server /health)
// 6. Get KB stats, queue depths from Redis
// Assemble AdminStatusResponse and return
```

### Acceptance criteria
- `POST /auth/login` with valid credentials returns valid JWT
- `POST /auth/login` with wrong password returns 401
- `GET /me` with expired token returns 401
- `POST /admin/users` without admin JWT returns 403
- `GET /api/admin/status` returns correct shape (all 9 agents, health, spend)
- Rate limiter returns 429 after exceeding `telegram.yaml: rateLimitPerUserPerMinute`

### Tests required

```typescript
// Integration tests (real DB via testcontainers)
it('POST /auth/login returns accessToken and refreshToken for valid credentials')
it('POST /auth/login returns 401 for wrong password')
it('GET /me returns user object for valid JWT')
it('GET /me returns 401 for expired JWT')
it('POST /auth/refresh returns new accessToken for valid refreshToken')
it('POST /admin/users returns 403 for non-admin JWT')
it('POST /admin/users creates user and returns 201 for admin JWT')
it('GET /api/admin/status returns AdminStatusResponse shape')
```

---

## Spec 5 — MCP Server Skeleton + market-data-mcp

### Scope
Create the reusable MCP server skeleton (Hono + `/health` + `/mcp/tools` + `/mcp/invoke`), then fully implement `market-data-mcp`. This establishes the pattern for all other MCP servers.

### Files to create

```
mcp-servers/shared/src/mcp-server-factory.ts   # reusable Hono factory
mcp-servers/market-data/src/index.ts
mcp-servers/market-data/src/tools/registry.ts
mcp-servers/market-data/src/tools/get-quote.ts
mcp-servers/market-data/src/tools/get-ohlcv.ts
mcp-servers/market-data/src/tools/get-fundamentals.ts
mcp-servers/market-data/src/tools/get-earnings.ts
mcp-servers/market-data/src/tools/get-multiple-quotes.ts
mcp-servers/market-data/src/tools/get-analyst-ratings.ts
mcp-servers/market-data/src/tools/get-price-targets.ts
mcp-servers/market-data/src/cache.ts
mcp-servers/market-data/src/clients/finnhub.ts
mcp-servers/market-data/src/clients/fmp.ts
```

### MCP server factory

Every MCP server is created with `createMcpServer(toolRegistry)`:

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  handler: (input: unknown) => Promise<unknown>;
}

export function createMcpServer(tools: ToolDefinition[]): Hono;
// Registers: GET /health, GET /mcp/tools, POST /mcp/invoke
// POST /mcp/invoke validates input with tool's inputSchema → calls handler → validates output
// Returns { output, durationMs } on success
// Returns { error, code } on failure — never throws unhandled
```

### Tool manifest format (GET /mcp/tools)

```json
{
  "tools": [
    {
      "name": "get_quote",
      "description": "Get current price, change, volume, and 52-week range for a ticker",
      "inputSchema": { "type": "object", "properties": { "ticker": { "type": "string" } }, "required": ["ticker"] },
      "outputSchema": { ... }
    }
  ]
}
```

### Cache layer (`cache.ts`)

```typescript
// TTLs come from mcp.yaml — passed in at startup
export function createCache(redis: Redis, ttls: Record<string, number>): McpCache;

interface McpCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  // Key format: mcp:{server}:{tool}:{hash(input)}
}
```

### Tool output types (from `packages/shared-types/src/mcp.types.ts`)

```typescript
export interface QuoteOutput {
  price: number; change_pct: number; volume: number;
  market_cap: number; high_52w: number; low_52w: number;
}
export interface OhlcvOutput {
  candles: Array<{ o: number; h: number; l: number; c: number; v: number; t: number }>;
}
export interface FundamentalsOutput {
  pe_ratio: number | null; eps: number | null;
  revenue_growth_yoy: number | null; debt_to_equity: number | null; sector: string;
}
export interface EarningsOutput {
  next_date: string | null; days_until: number | null;
  estimate_eps: number | null; prev_eps: number | null; surprise_pct_last: number | null;
}
export interface AnalystRatingsOutput {
  strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number; period: string;
}
export interface PriceTargetsOutput {
  avg_target: number; high_target: number; low_target: number; analyst_count: number;
}
```

### API client notes

- **Finnhub:** base URL `https://finnhub.io/api/v1`, auth via `token` query param from `FINNHUB_API_KEY`
- **FMP:** base URL `https://financialmodelingprep.com/api/v3`, auth via `apikey` query param from `FMP_API_KEY`
- Source selection: `get_quote`, `get_ohlcv`, `get_fundamentals`, `get_earnings` → Finnhub primary; FMP as fallback
- `get_analyst_ratings`, `get_price_targets` → FMP only

### Acceptance criteria
- `GET /health` returns `{ status: "ok", uptime: number }`
- `GET /mcp/tools` returns all 7 tool definitions with valid JSON Schemas
- `POST /mcp/invoke { tool: "get_quote", input: { ticker: "NVDA" } }` returns valid QuoteOutput
- Cache: second call to `get_fundamentals` for same ticker returns cached value without hitting Finnhub
- Invalid input returns 400 with Zod error detail

### Tests required

```typescript
// Unit tests — mocked Finnhub + FMP HTTP responses via msw
it('get_quote returns QuoteOutput for valid ticker')
it('get_quote returns cached value on second call (no HTTP request)')
it('get_ohlcv returns candles array with correct OHLCV shape')
it('get_multiple_quotes batches single HTTP call for all tickers')
it('POST /mcp/invoke with unknown tool name returns 404')
it('POST /mcp/invoke with invalid input returns 400 with field error')
```

---

## Spec 6 — Remaining 5 MCP Servers

### Scope
Implement the remaining 5 MCP servers using the factory from Spec 5. Each follows identical structure.

### macro-signals-mcp (port 3002)

```
mcp-servers/macro-signals/src/index.ts
mcp-servers/macro-signals/src/tools/registry.ts
mcp-servers/macro-signals/src/tools/get-gdelt-risk.ts
mcp-servers/macro-signals/src/tools/get-eco-calendar.ts
mcp-servers/macro-signals/src/tools/get-indicator.ts
mcp-servers/macro-signals/src/tools/get-sector-macro-context.ts
mcp-servers/macro-signals/src/clients/gdelt.ts
mcp-servers/macro-signals/src/clients/alpha-vantage.ts
```

GDELT endpoint: `https://api.gdeltproject.org/api/v2/doc/doc?query={topic}&mode=artlist&format=json` — no API key required.
Alpha Vantage: `https://www.alphavantage.co/query`, auth via `apikey` from `ALPHA_VANTAGE_API_KEY`.

### news-mcp (port 3003)

```
mcp-servers/news/src/tools/get-ticker-news.ts
mcp-servers/news/src/tools/search-news.ts
mcp-servers/news/src/tools/get-sentiment-summary.ts
mcp-servers/news/src/tools/get-top-sentiment-shifts.ts
mcp-servers/news/src/tools/get-sector-movers.ts
```

### rag-retrieval-mcp (port 3004)

Read-only access to pgvector. Uses the same `DATABASE_URL` env var.

```typescript
// Hybrid search: cosine similarity + BM25 via ts_rank, merged with RRF
// bm25Weight from rag.yaml (default 0.3)
// RRF formula: 1/(k + rank) where k=60
async function search(query: string, limit: number, filters?: SearchFilters): Promise<SearchResult[]>
```

### enterprise-connector-mcp (port 3005)

Mock only. Load from `mock-data/documents.ts` and `mock-data/emails.ts`. These should contain realistic corporate content: quarterly earnings transcripts, analyst reports, internal memos. At least 10 documents, 5 email threads.

### trader-platform-mcp (port 3006)

Uses its own Prisma DB connection for ticket persistence. Implements mock and saxo modes controlled by `trader.yaml: platform`. In mock mode: `place_order` simulates fill at `market_price × (1 ± mockExecutionSlippagePct)`. In saxo mode: placeholder that logs "saxo mode not yet implemented" and returns mock response.

### Acceptance criteria for all 5
- All `/health` endpoints return 200
- All `/mcp/tools` return valid manifests
- rag-retrieval-mcp `search("NVDA thesis")` returns results after seed data is loaded
- trader-platform-mcp full ticket lifecycle: create → get → place_order → verify approved status

---

## Spec 7 — MCP Client + Model Router

### Scope
Create `lib/mcp-client.ts` which registers all MCP servers as Vercel AI SDK `tool()` bindings at startup. Create `lib/model-router.ts` which resolves the correct provider client per agent.

### Files to create

```
apps/api/src/lib/mcp-client.ts
apps/api/src/lib/model-router.ts
```

### `mcp-client.ts`

```typescript
import { tool } from 'ai';

// Called once at startup with loaded McpConfig
export async function initMcpClients(config: McpConfig): Promise<McpToolSets>;

export interface McpToolSets {
  marketData: Record<string, ReturnType<typeof tool>>;
  macroSignals: Record<string, ReturnType<typeof tool>>;
  news: Record<string, ReturnType<typeof tool>>;
  ragRetrieval: Record<string, ReturnType<typeof tool>>;
  enterpriseConnector: Record<string, ReturnType<typeof tool>>;
  traderPlatform: Record<string, ReturnType<typeof tool>>;
  all: Record<string, ReturnType<typeof tool>>;  // merged — for Researcher
}
```

Implementation:
1. Fetch `/mcp/tools` from each MCP server at startup
2. For each tool in the manifest, create a Vercel AI SDK `tool()` with the declared input schema
3. The tool's execute function calls `POST /mcp/invoke { tool: name, input }` on the MCP server
4. Log startup success/failure per server — fail-fast if any server is unreachable on startup

### `model-router.ts`

```typescript
export interface ResolvedProvider {
  client: LanguageModelV1;  // Vercel AI SDK provider
  model: string;
  provider: Provider;
  temperature: number;
  maxTokens: number;
}

// Returns the correct provider client for an agent, falling back if needed
export function resolveProvider(
  agentName: AgentName,
  config: AgentsConfig,
  lmStudioAvailable: boolean,
  modeOverride?: { temperature: number }  // for devil_advocate
): ResolvedProvider;

// Probe LM Studio — called on startup and every 5 min
export async function probeLmStudio(baseUrl: string): Promise<boolean>;
```

### Acceptance criteria
- `initMcpClients` succeeds when all 6 MCP servers are running
- `initMcpClients` throws with clear error when a server is unreachable
- `resolveProvider('analyst', config, true)` returns anthropic client
- `resolveProvider('reporter', config, false)` returns openai/gpt-4o-mini (LM Studio fallback)
- `resolveProvider('analyst', config, true, { temperature: 0.7 })` returns correct temperature override

### Tests required

```typescript
// Unit tests
it('resolveProvider returns lmstudio client for reporter when available')
it('resolveProvider returns openai fallback for reporter when lmstudio unavailable')
it('resolveProvider returns azure fallback for manager when anthropic unavailable')
it('resolveProvider applies devilAdvocateTemperature override for analyst mode')
it('probeLmStudio returns true when /v1/models responds with model list')
it('probeLmStudio returns false when request times out')
```

---

## Spec 8 — Collector Agents (Watchdog, Screener, Technician, Researcher)

### Scope
Implement the four data-collection agents. These do not synthesise — they collect, compute, or scan, then return typed output. Implement alongside the BullMQ scheduler and workers.

### Files to create

```
apps/api/src/agents/watchdog.ts
apps/api/src/agents/watchdog.prompt.ts     # minimal — mostly logic
apps/api/src/agents/screener.ts
apps/api/src/agents/screener.prompt.ts
apps/api/src/agents/researcher.ts
apps/api/src/agents/researcher.prompt.ts
apps/api/src/agents/technician.ts
apps/api/src/agents/technician.prompt.ts
apps/api/src/agents/shared/confidence-instruction.prompt.ts
apps/api/src/workers/scheduler.ts
apps/api/src/workers/watchdog-worker.ts
apps/api/src/workers/screener-worker.ts
apps/api/src/workers/ticket-expiry-worker.ts
```

### Agent state Redis writes

Every agent must write its state before and after execution:

```typescript
// At start of any agent function:
await redis.set(
  RedisKey.agentState(agentName),
  JSON.stringify({ state: 'active', currentTask, currentMissionId, startedAt: new Date().toISOString() }),
  'EX', 600  // 10 min TTL
);

// On completion:
await redis.set(
  RedisKey.agentState(agentName),
  JSON.stringify({ state: 'idle', lastActiveAt: new Date().toISOString(), lastActivitySummary }),
  'EX', 600
);

// On error:
await redis.set(
  RedisKey.agentState(agentName),
  JSON.stringify({ state: 'error', errorMessage: err.message }),
  'EX', 600
);
```

### Watchdog implementation notes

```typescript
export async function runWatchdog(
  tools: McpToolSets,
  config: AppConfig,
  db: PrismaClient
): Promise<WatchdogResult>

interface WatchdogResult {
  tickersScanned: number;
  alertsCreated: number;
  snapshotsWritten: number;
}
```

Steps (see CASE.md §10.2):
1. Fetch all active WatchlistItems across all users
2. Batch `get_multiple_quotes` call
3. Compare against latest PriceSnapshot per ticker
4. `get_earnings` per ticker (uses market-data-mcp cache)
5. For flagged: `get_ticker_news`
6. Write PriceSnapshot for every ticker
7. For each signal: create Alert → push to `alertPipelineQueue`

### Researcher implementation notes

```typescript
export async function runResearcher(input: {
  ticker: string;
  focusQuestions: string[];
  userId: string;
  mcpTools: McpToolSets;
  config: AppConfig;
}): Promise<ResearchOutput>
```

The Researcher uses `generateText` with `tool()` bindings from `mcpTools.all`. The system prompt (from `researcher.prompt.ts`) instructs the model to call the appropriate MCP tools based on `focusQuestions` and return ONLY a structured JSON object — no analysis, no conclusions. The `maxSteps` parameter should be set to allow multiple tool calls (e.g. `maxSteps: 10`).

Critical: validate the output against the `ResearchOutput` type before returning. If the model returns malformed JSON, throw and let BullMQ retry.

### Technician implementation notes

```typescript
export async function runTechnician(input: {
  ticker: string;
  periodWeeks: number;
  mcpTools: McpToolSets;
  config: AppConfig;
}): Promise<TechnicianOutput>
```

1. Fetch OHLCV via `mcpTools.marketData.get_ohlcv` for `periodWeeks * 7` days of daily candles
2. Compute indicators using `technicalindicators` npm package (pure math, no LLM)
3. Pass computed values to `generateText` for natural language interpretation
4. Return typed `TechnicianOutput`

### Scheduler

```typescript
// workers/scheduler.ts — called once at agent-worker startup
export async function initScheduler(config: AppConfig): Promise<void>;
// Registers all repeatable BullMQ jobs from scheduler.yaml cron expressions
// Idempotent — safe to call on restart (BullMQ deduplicates repeatable jobs by key)
```

### Acceptance criteria
- `runWatchdog()` writes PriceSnapshot records for every active ticker
- `runWatchdog()` creates an Alert and enqueues it when price change exceeds threshold
- `runResearcher({ ticker: 'NVDA', focusQuestions: ['recent news'] })` returns valid `ResearchOutput`
- `runTechnician({ ticker: 'NVDA', periodWeeks: 3 })` returns valid `TechnicianOutput` with RSI value in 0–100 range
- BullMQ repeatable jobs are registered on startup with correct cron expressions

### Tests required

```typescript
// Unit tests
it('runWatchdog creates alert when price change exceeds threshold')
it('runWatchdog does NOT create alert when price change is within threshold')
it('runResearcher returns ResearchOutput with all required fields (mocked MCP)')
it('runTechnician RSI is between 0 and 100 for valid OHLCV data')
it('runTechnician MACD signal is one of the expected enum values')
it('runScreener persists ScreenerRun with correct triggeredBy field')
```

---

## Spec 9 — Reasoning Agents (Analyst, Bookkeeper, Reporter, Trader)

### Scope
Implement the four reasoning/delivery agents. These are the core of the platform's intelligence.

### Files to create

```
apps/api/src/agents/analyst.ts
apps/api/src/agents/analyst.prompt.ts
apps/api/src/agents/analyst.devil-advocate.prompt.ts
apps/api/src/agents/bookkeeper.ts
apps/api/src/agents/bookkeeper.prompt.ts
apps/api/src/agents/bookkeeper.contradiction.prompt.ts
apps/api/src/agents/reporter.ts
apps/api/src/agents/reporter.prompt.ts
apps/api/src/agents/trader.ts
apps/api/src/agents/trader.prompt.ts
apps/api/src/agents/shared/portfolio-context.prompt.ts
apps/api/src/lib/portfolio-context.ts
```

### Analyst implementation notes

```typescript
export async function runAnalyst(input: {
  researchData: ResearchOutput | ResearchOutput[];  // array for comparison mode
  existingThesis: string | null;
  portfolioContext?: { quantity: number; ticker: string };
  mode: AnalystMode;
  config: AppConfig;
}): Promise<AnalystOutput>
```

- `mode === 'devil_advocate'`: use `analyst.devil-advocate.prompt.ts`, override temperature with `config.agents.analyst.devilAdvocateTemperature`
- `mode === 'comparison'`: expects `researchData` as array, returns `comparisonTable` in output
- When `portfolioContext.quantity > 0`: append `portfolio-context.prompt.ts` to system prompt
- Analyst has NO tools — `generateText` with no `tools` parameter, just system + user prompts
- Validate `AnalystOutput` shape before returning — retry on malformed JSON

### Bookkeeper implementation notes

Strictly follows the flowchart in CASE.md §10.7:

```typescript
export async function runBookkeeper(input: BookkeeperInput): Promise<void>
// BookkeeperInput from shared-types (Spec 1)
```

1. Fetch existing thesis via `ragRetrieval.get_current_thesis`
2. Branch on `mode === 'devil_advocate'` (see corrected flowchart in CASE.md §10.7)
3. For contradiction check: use `generateText` with `bookkeeper.contradiction.prompt.ts` system prompt, `response_format: { type: "json_object" }`, parse result
4. Generate embedding via LangChain `OpenAIEmbeddings`: `new OpenAIEmbeddings({ model: config.rag.embeddingModel }).embedQuery(analystOutput.thesisUpdate)` — never call `openai.embeddings.create` directly
5. Upsert `KbEntry` + create `KbThesisSnapshot` in a DB transaction
6. If `contradictionFound && severity === 'high'`: create Alert record
7. Update `Mission.status = 'complete'`

### Reporter implementation notes

```typescript
export async function runReporter(input: {
  missionOutput: AnalystOutput | TechnicianOutput | ScreenerRun;
  missionType: MissionType;
  userId: string;
  config: AppConfig;
}): Promise<void>
```

- Select output label from CASE.md §10.8 based on `missionType` and output content
- Use LM Studio (via `resolveProvider('reporter', ...)`) for formatting — `generateText` with formatting prompt
- Call `telegram.post(userId, formattedMessage)` via Telegraf API
- For `daily_brief`: also call `db.writeDailyBrief(userId, brief)`
- Reporter never analyses — it only formats and delivers

### Trader implementation notes

```typescript
export async function runTrader(input: {
  ticker: string;
  action: 'buy' | 'sell';
  quantity: number;
  analystOutput: AnalystOutput;
  technicianOutput?: TechnicianOutput;
  userId: string;
  config: AppConfig;
  mcpTools: McpToolSets;
}): Promise<{ ticketId: string }>
```

- Read current thesis via `mcpTools.ragRetrieval.get_current_thesis`
- Use `generateText` to formulate exactly 3-sentence rationale citing the analysis
- Call `mcpTools.traderPlatform.create_ticket(...)` 
- Always append: `"⚠️ This ticket requires explicit human approval. FinSight never executes trades autonomously."`
- Return `{ ticketId }` to Manager for Reporter delivery

### Acceptance criteria
- `runAnalyst` with standard mode returns `AnalystOutput` with all required fields
- `runAnalyst` with devil_advocate mode uses higher temperature (verify via spy on generateText)
- `runBookkeeper` writes `KbEntry` + `KbThesisSnapshot` to DB (integration test)
- `runBookkeeper` creates `thesis_contradiction` Alert when contradictionFound is true
- `runBookkeeper` does NOT snapshot when `changeType === 'initial'` (no prior thesis)
- `runBookkeeper` snapshots existing thesis even in `devil_advocate` mode
- `runTrader` creates TradeTicket via trader-platform-mcp
- `runReporter` calls `telegram.post` with correct label prefix

### Tests required

```typescript
// Unit tests
it('runAnalyst standard mode returns AnalystOutput with confidence field')
it('runAnalyst comparison mode returns comparisonTable in output')
it('runAnalyst devil_advocate uses devilAdvocateTemperature override')
it('runBookkeeper contradictionFound: true creates thesis_contradiction Alert')
it('runBookkeeper contradictionFound: false does NOT create Alert')
it('runBookkeeper initial changeType skips snapshot creation')
it('runBookkeeper devil_advocate still snapshots existing thesis before overwrite')

// Integration tests (real DB)
it('runBookkeeper writes KbEntry with embedding vector to pgvector')
it('runBookkeeper writes KbThesisSnapshot with correct changeType')
it('runTrader creates TradeTicket with pending_approval status')
```

---

## Spec 10 — Manager + Mission Orchestration

### Scope
Implement Manager — the orchestration entry point. Create all remaining API routes. Implement `lib/langsmith.ts` middleware.

### Files to create

```
apps/api/src/agents/manager.ts
apps/api/src/agents/manager.prompt.ts
apps/api/src/routes/chat.ts
apps/api/src/routes/missions.ts
apps/api/src/routes/kb.ts
apps/api/src/routes/portfolio.ts
apps/api/src/routes/watchlist.ts
apps/api/src/routes/alerts.ts
apps/api/src/routes/tickets.ts
apps/api/src/routes/briefs.ts
apps/api/src/routes/agents.ts
apps/api/src/lib/langsmith.ts
apps/api/src/workers/alert-pipeline-worker.ts
apps/api/src/workers/brief-worker.ts
apps/api/src/workers/earnings-worker.ts
```

### Manager implementation

```typescript
export async function runManager(input: {
  userMessage: string;
  userId: string;
  config: AppConfig;
  mcpTools: McpToolSets;
  db: PrismaClient;
}): Promise<ManagerResult>

interface ManagerResult {
  missionId: string;
  response: string;
  trigger: MissionTrigger;
}
```

Manager uses `generateText` with its own tool() bindings for dispatching other agents. The system prompt must include the full intent routing table from CASE.md §10.1.

**KB fast-path check (operator_query only):**
```typescript
const existing = await mcpTools.ragRetrieval.get_current_thesis({ ticker });
if (existing?.confidence === 'high' && isWithin24h(existing.last_updated)) {
  // Return directly, log trigger: 'kb_fast_path'
  return { missionId, response: existing.thesis, trigger: 'kb_fast_path' };
}
```

**Parallel dispatch (comparison mode):**
```typescript
const results = await Promise.all(
  tickers.map(ticker => runResearcher({ ticker, focusQuestions, userId, mcpTools, config }))
);
const analystOutput = await runAnalyst({ researchData: results, mode: 'comparison', ... });
```

**Confidence-gated re-dispatch:**
```typescript
if (analystOutput.confidence === 'low' && config.agents.confidence.reDispatchOnLow) {
  const refined = await runResearcher({ ticker, focusQuestions: analystOutput.contradictions, ... });
  analystOutput = await runAnalyst({ researchData: refined, ... });
}
```

### Route implementations

**POST /api/chat:**
- Validate body: `{ message: string, ticker?: string }`
- Create Mission record with `status: 'running'`
- Call `runManager(...)` — await full completion (not streaming)
- Update Mission `status: 'complete'`, `outputData`
- Return `{ missionId, response }`

**GET /api/missions:** Returns last 20 missions for admin, user's own missions for analyst role
**GET /api/missions/:id:** Returns mission + all AgentRun records
**GET /api/kb/search:** Calls `mcpTools.ragRetrieval.search(...)`
**GET /api/kb/thesis/:ticker:** Calls `mcpTools.ragRetrieval.get_current_thesis(...)`
**GET /api/kb/history/:ticker:** Calls `mcpTools.ragRetrieval.get_thesis_history(...)`
**GET/PUT /api/portfolio:** User's PortfolioItem records
**GET/POST/DELETE /api/watchlist:** User's WatchlistItem records
**GET /api/alerts:** Unacknowledged alerts for current user
**POST /api/alerts/:id/ack:** Acknowledge alert
**GET /api/tickets:** Pending TradeTickets for current user (admin sees all)
**POST /api/tickets/:id/approve:** Calls `mcpTools.traderPlatform.place_order(...)`
**POST /api/tickets/:id/reject:** Updates ticket status
**GET /api/briefs/latest:** Latest DailyBrief for current user
**GET /api/agents/status:** LM Studio probe result + all 9 agent Redis states

### LangSmith middleware

```typescript
// lib/langsmith.ts
export function langsmithInject(): MiddlewareHandler;
// Attaches LangSmith run context to each request
// Generates langsmithUrl per mission run
// All agent generateText calls inherit this context automatically via AI SDK
```

### Acceptance criteria
- `POST /api/chat { message: "What is happening with NVDA?" }` creates a Mission and returns a response
- KB fast-path returns response without creating AgentRun records for Researcher/Analyst
- `/compare NVDA AMD` (detected as comparison intent) dispatches two parallel Researcher jobs
- All route CRUD operations work correctly
- Mission status updates to `complete` after full pipeline run
- AgentRun records are created for each agent step with correct `costUsd` values

### Tests required

```typescript
// Integration tests
it('POST /api/chat creates Mission and returns response')
it('POST /api/chat with known thesis uses KB fast-path (no AgentRun for Researcher)')
it('POST /api/chat with multiple tickers dispatches parallel Researcher jobs')
it('GET /api/missions/:id returns mission with AgentRun records')
it('POST /api/tickets/:id/approve calls place_order on trader-platform-mcp')

// E2E test
it('full operator_query pipeline: chat → mission complete → KB entry created')
```

---

## Spec 11 — Telegram Bot

### Scope
Implement the `telegram-bot` container — Telegraf polling bot that handles all user commands.

### Files to create

```
apps/api/src/telegram/bot.ts
apps/api/src/telegram/handler.ts
apps/api/src/telegram/formatter.ts
apps/api/src/telegram/push.ts
```

### `bot.ts`

```typescript
import { Telegraf } from 'telegraf';

export function createBot(token: string): Telegraf;
// Registers all 16 command handlers from CASE.md §4 Telegram section
// Starts Telegraf polling (bot.launch())
// Graceful shutdown on SIGTERM
```

### `handler.ts`

All handlers follow this pattern:

```typescript
// 1. Validate sender against DB (telegramHandle matching)
const user = await db.user.findUnique({ where: { telegramHandle: ctx.from?.username } });
if (!user || !user.active) { await ctx.reply('⛔ Access denied.'); return; }

// 2. Check rate limit (Redis-backed, from telegram.yaml)
const rateLimitOk = await checkRateLimit(user.id);
if (!rateLimitOk) { await ctx.reply('⏱ Rate limit exceeded. Please wait.'); return; }

// 3. Parse command arguments
// 4. Call internal API (POST /api/chat or relevant endpoint)
// 5. Buffer full response
// 6. Reply to user
```

### Command → API mapping

| Command | Internal API call |
|---|---|
| `/brief` | `GET /api/briefs/latest` |
| `/pattern TICKER Nw` | `POST /api/chat { message: "/pattern TICKER Nw" }` |
| `/compare T1 T2` | `POST /api/chat { message: "/compare T1 T2" }` |
| `/devil TICKER` | `POST /api/chat { message: "/devil TICKER" }` |
| `/thesis TICKER` | `GET /api/kb/thesis/:ticker` |
| `/history TICKER` | `GET /api/kb/history/:ticker` |
| `/screener show last` | `GET /api/screener/last` |
| `/trade TICKER buy\|sell QTY` | `POST /api/chat { message }` |
| `/approve TICKET_ID` | `POST /api/tickets/:id/approve` |
| `/reject TICKET_ID` | `POST /api/tickets/:id/reject` |
| `/alert` | `GET /api/alerts` |
| `/ack ALERT_ID` | `POST /api/alerts/:id/ack` |
| `/watchlist` | `GET /api/watchlist` |
| `/add TICKER type` | `POST /api/watchlist` |
| `/portfolio` | `GET /api/portfolio` |
| `/help` | Static response listing all commands |

### `formatter.ts`

```typescript
// Apply output labels (from CASE.md §10.8)
export function applyLabel(message: string, missionType: MissionType): string;

// Telegram message length limit: 4096 characters
// Split long messages into multiple replies
export function splitMessage(text: string, maxLength?: number): string[];

// Format KbThesisSnapshot list for /history command
export function formatThesisHistory(snapshots: KbThesisSnapshot[]): string;

// Format DailyBrief sections for /brief command
export function formatDailyBrief(brief: DailyBrief): string;
```

### `push.ts` — proactive message delivery

```typescript
// Called by Reporter and Watchdog to push messages without a user command
export async function pushToUser(userId: string, message: string): Promise<void>;
// Looks up user.telegramHandle, calls bot.telegram.sendMessage(chatId, message)
// chatId is obtained from the first message the user sent (stored on User record)
```

**Note:** Telegram requires a `chat_id` to send messages. Update the `User` model to include `telegramChatId: BigInt?` — populated the first time a user sends any message to the bot.

### Acceptance criteria
- Unknown Telegram handle receives `"⛔ Access denied."` and no further processing
- `/help` returns all 16 commands
- `/pattern NVDA 3w` dispatches Technician and returns formatted TA summary
- `/screener show last` returns last ScreenerRun without triggering a new scan
- Rate limit returns throttle message after exceeding `rateLimitPerUserPerMinute`
- `/history NVDA` after seed returns 4 snapshots including contradiction entry

### Tests required

```typescript
// Unit tests
it('handler rejects unknown telegramHandle with access denied')
it('handler parses /pattern NVDA 3w correctly: ticker=NVDA, weeks=3')
it('handler parses /trade NVDA buy 10 correctly: action=buy, qty=10')
it('handler parses /compare NVDA AMD correctly: tickers=[NVDA, AMD]')
it('formatter applyLabel prefixes DEVIL_ADVOCATE for devil_advocate missionType')
it('formatter splitMessage splits at 4096 chars without cutting words')

// E2E test
it('full Telegram command flow: /pattern NVDA 3w → Technician runs → reply delivered')
```

---

## Spec 12 — Admin Dashboard (React Frontend)

### Scope
Implement the React SPA admin dashboard. Matches `docs/dashboard-reference.html` exactly.

### Files to create

```
apps/dashboard/index.html
apps/dashboard/vite.config.ts
apps/dashboard/tsconfig.json
apps/dashboard/package.json
apps/dashboard/src/App.tsx
apps/dashboard/src/contexts/AuthContext.tsx
apps/dashboard/src/hooks/useAdminStatus.ts
apps/dashboard/src/components/LoginPage.tsx
apps/dashboard/src/components/Layout.tsx
apps/dashboard/src/components/AgentColumn.tsx
apps/dashboard/src/components/AgentCard.tsx
apps/dashboard/src/components/MissionPanel.tsx
apps/dashboard/src/components/PipelineView.tsx
apps/dashboard/src/components/ToolCallList.tsx
apps/dashboard/src/components/MissionLog.tsx
apps/dashboard/src/components/SystemPanel.tsx
apps/dashboard/src/components/SpendPanel.tsx
```

### Layout

```
4-column CSS grid: grid-template-columns: 280px 1fr 200px 180px
Header: fixed top, full-width
Body: remaining height, overflow-y: auto per column
```

### `useAdminStatus` hook

```typescript
function useAdminStatus(): {
  data: AdminStatusResponse | null;
  loading: boolean;
  error: string | null;
}
// Polls GET /api/admin/status every 3000ms
// Stops polling when tab is not visible (visibilitychange event)
// Restarts polling when tab becomes visible again
// On 401: clears auth context, redirects to login
```

### `AgentCard` props and visual spec

```typescript
interface AgentCardProps {
  name: AgentName;
  state: AgentState;
  currentTask: string | null;
  model: string;
  provider: Provider;
  todayCostUsd: number;
  todayTokensIn: number;
  todayTokensOut: number;
  lastActivitySummary: string | null;
}
```

Visual (from `dashboard-reference.html`):
- 3-zone single row grid: `84px 1fr auto`
- Left border accent: `2.5px solid` — green=active, amber=queued, transparent=idle, red=error
- Active card background: `#f7fffc`; queued: `#fffdf7`

### `PipelineView` + `ToolCallList`

```typescript
interface PipelineViewProps {
  steps: AdminStatusResponse['activeMission']['steps'];
}
// Renders vertical step list
// Active step: pulsing ring on node (box-shadow: 0 0 0 2.5px var(--green-ring))
// Active step: expands to show ToolCallList
```

```typescript
interface ToolCallListProps {
  toolCalls: Array<{ name: string; mcpServer: string; state: 'done' | 'running' | 'pending' }>;
}
// done: filled green dot
// running: CSS spinner (border-top-color: transparent; animation: spin 0.8s linear infinite)
// pending: empty grey dot
```

### `AuthContext`

```typescript
interface AuthContextValue {
  user: { id: string; name: string; role: UserRole } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
// JWT stored in memory only (NOT localStorage — see CONTEXT.md §9 constraints)
// Refresh token stored in httpOnly cookie (set by /auth/login response)
// Access token refreshed automatically 1 minute before expiry
```

### Acceptance criteria
- Login page appears when no JWT is in memory
- After login, dashboard loads with 9 agent cards
- Agent cards update every 3 seconds
- Active agent card shows green left border and light green background
- Active mission pipeline shows tool call spinner for `state: "running"` tool calls
- SpendPanel shows correct per-provider breakdown
- "Trigger Screener" button calls `POST /api/screener/trigger` and shows feedback
- "Reload Config" button calls `POST /admin/config/reload` and shows changed keys

---

## Spec 13 — Seed Script + Pulumi IaC

### Scope
Create the seed script that creates a fully demo-ready state. Create the Pulumi AWS infrastructure.

### Files to create

```
apps/api/prisma/seed.ts
infra/pulumi/index.ts
infra/pulumi/package.json
```

### Seed script (full requirements from CASE.md §14)

```typescript
// prisma/seed.ts — run with: pnpm prisma db seed
// idempotent: check existence before creating

// 1. Admin user — email from ADMIN_EMAIL env, password from ADMIN_PASSWORD env
// 2. Analyst user — analyst@finsight.local, password: demo1234
// 3. Admin portfolio — NVDA 50, AAPL 100, GLD 20
// 4. Admin watchlists — "portfolio": NVDA/AAPL/GLD, "interesting": SPY/AMD/MSFT
// 5. NVDA KB entries:
//    - current bullish thesis as KbEntry with vector embedding
//    - 3 KbThesisSnapshots: -7d (cautious), -4d (contradiction), -1d (bullish)
// 6. ScreenerRun — today, triggered by "scheduled", 3 finds including AMD semiconductors
// 7. Alert — earnings_approaching, NVDA, high severity, 2 days from now
// 8. 2 prior missions with AgentRun records (daily_brief and pattern_request types)
// 9. 3 KbEntries from "PDF ingestion" — realistic earnings transcript excerpts

// For vector embeddings: call OpenAI embeddings API directly in seed
// Use OPENAI_API_KEY from env
```

### Pulumi IaC (`infra/pulumi/index.ts`)

One ECS Fargate task per container, all in the same VPC:

```typescript
// Core resources:
// - VPC with public + private subnets
// - ECS Cluster
// - RDS PostgreSQL 16 (db.t3.micro for PoC)
//   - pgvector extension enabled via RDS parameter group
// - ElastiCache Redis 7 (cache.t3.micro)
// - ECR repository per app service (hono-api, agent-worker, all 6 MCP servers, frontend, telegram-bot)
// - ECS Task Definitions — one per service, container image from ECR
// - ECS Services — with desired count 1
// - ALB with target group for hono-api:3000 and frontend:4000
// - Security groups: allow internal communication between services
// - Secrets Manager: store .env values (not hard-coded in task defs)
```

### Acceptance criteria for seed
- `pnpm prisma db seed` runs idempotently (safe to run twice)
- After seed: `GET /api/kb/thesis/NVDA` returns bullish thesis
- After seed: `GET /api/kb/history/NVDA` returns 3 snapshots including one with `changeType: "contradiction"`
- After seed: `GET /api/screener/last` returns non-empty results
- After seed: `GET /api/alerts` for admin returns 1 alert (earnings_approaching)
- After seed: `GET /api/missions` returns 2 missions

---

## Spec 14 — CI/CD + Scripts

### Scope
Create the GitHub Actions workflow, deploy scripts, and `.github` configuration.

### Files to create

```
.github/workflows/ci.yml           # exact content from CASE.md §9.2
.env.example                       # all required vars, no values
scripts/deploy.sh
scripts/logs.sh
```

### `scripts/deploy.sh`

```bash
#!/usr/bin/env bash
# Usage: ./scripts/deploy.sh [SERVER_USER] [SERVER_IP]
# Runs on dev laptop (Podman/Windows side), deploys to Linux server via SSH

SERVER_USER=${1:-ubuntu}
SERVER_IP=${2:-192.168.1.X}
REMOTE_DIR=/home/${SERVER_USER}/finsight

rsync -av --exclude=node_modules --exclude=.git --exclude=.env \
  ./config/runtime/ ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/config/runtime/

rsync -av --exclude=node_modules --exclude=.git \
  ./docker-compose.yml \
  ./docker-compose.dev.yml \
  ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/

ssh ${SERVER_USER}@${SERVER_IP} "
  cd ${REMOTE_DIR} &&
  docker compose pull &&
  docker compose up -d --remove-orphans &&
  sleep 5 &&
  curl -sf http://localhost:3000/health && echo 'API healthy' &&
  curl -sf http://localhost:3001/health && echo 'market-data-mcp healthy'
"
```

### `scripts/logs.sh`

```bash
#!/usr/bin/env bash
# Usage: ./scripts/logs.sh hono-api
# Tails logs for a named container on the server

SERVER_USER=${DEPLOY_USER:-ubuntu}
SERVER_IP=${DEPLOY_HOST:-192.168.1.X}
SERVICE=${1:-hono-api}

ssh ${SERVER_USER}@${SERVER_IP} "docker compose logs -f ${SERVICE}"
```

### `.env.example`

Must document every env var from CASE.md §15 with clear comments and example format. No real values.

### Acceptance criteria
- `scripts/deploy.sh` successfully deploys to the Linux server
- CI workflow runs all jobs on self-hosted runner
- Deploy job only runs on `main` branch push
- PR to `develop` triggers CI but not deploy
- `pnpm -r build` succeeds in CI environment

---

## Implementation Order Summary

```
Spec 1  — Shared types              (no dependencies)
Spec 2  — Config loader             (depends on Spec 1)
Spec 3  — Prisma + Docker           (depends on Spec 2)
Spec 4  — Auth + Admin API          (depends on Specs 1-3)
Spec 5  — MCP skeleton + market-data (depends on Specs 1-3)
Spec 6  — Remaining 5 MCP servers   (depends on Spec 5)
Spec 7  — MCP client + model router (depends on Specs 4-6)
Spec 8  — Collector agents          (depends on Specs 6-7)
Spec 9  — Reasoning agents          (depends on Specs 7-8)
Spec 10 — Manager + all routes      (depends on Specs 8-9)
Spec 11 — Telegram bot              (depends on Spec 10)
Spec 12 — Admin dashboard           (depends on Spec 4 + Spec 10)
Spec 13 — Seed + Pulumi             (depends on all above)
Spec 14 — CI/CD + scripts           (can be done any time after Spec 3)
```

Each spec is independently handable to a coding AI agent. The agent should read:
1. CASE.md (full spec)
2. CONTEXT.md (environment and constraints)
3. The specific spec brief above
4. Any referenced earlier specs for type definitions

---

*End of SPECKIT.md — FinSight AI Hub v1.0*
