# Contracts: Data Layer Interfaces

## Scope

These contracts define the internal interfaces and invariants that feature 002 exposes to the rest of the system.

## 1. Database Singleton Contract (`apps/api/src/lib/db.ts`)

### Export

```ts
export const db: PrismaClient;
```

### Invariants
- Singleton instance for process lifetime.
- No per-request Prisma client creation.
- Connectivity failures are surfaced during explicit connect/health check or first DB operation (fail-fast startup behavior at application bootstrap).

## 2. Redis Singleton + Key Helpers Contract (`apps/api/src/lib/redis.ts`)

### Exports

```ts
export const redis: Redis;

export const RedisKey: {
  agentState: (name: AgentName) => string;
  mcpCache: (server: string, tool: string, hash: string) => string;
};
```

### Key format requirements
- `RedisKey.agentState('manager') === 'agent:state:manager'`
- `RedisKey.mcpCache('market-data', 'get_quote', 'abc123') === 'mcp:market-data:get_quote:abc123'`

## 3. Queue Registry Contract (`apps/api/src/lib/queues.ts`)

### Exports

```ts
export const watchdogScanQueue: Queue;
export const screenerScanQueue: Queue;
export const dailyBriefQueue: Queue;
export const earningsCheckQueue: Queue;
export const ticketExpiryQueue: Queue;
export const alertPipelineQueue: Queue;
```

### Invariants
- Queue names are stable and unique.
- `watchdogScan`, `screenerScan`, `dailyBrief`, `earningsCheck`, and `ticketExpiry` are registered as repeatable queues from runtime scheduler config.
- `alertPipelineQueue` is push-triggered and is not registered as repeatable.
- All queues share the same Redis connection settings.

## 4. Container Topology Contract (`docker-compose.yml`)

### Required services
- `hono-api`, `agent-worker`, `market-data-mcp`, `macro-signals-mcp`, `news-mcp`, `rag-retrieval-mcp`, `enterprise-connector-mcp`, `trader-platform-mcp`, `frontend`, `telegram-bot`, `postgres`, `redis`.

### Required invariants
- `config/runtime` mounted read-only into app services.
- Health checks on `postgres`, `redis`, and MCP services.
- `restart: unless-stopped` on app containers.
