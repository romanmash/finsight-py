# Data Model: MCP Platform (004)

## Overview

This feature defines MCP-level request/response and tool-contract entities used by six independent servers. It also defines cache policy and retrieval/trader operational state objects built over existing infrastructure from features 001 and 002.

## Entities

### 1) McpToolDefinition
- **Fields**: `name`, `description`, `inputSchema`, `outputSchema`, `handler`
- **Validation**: tool names unique per server; schemas mandatory for all tools
- **Used by**: shared MCP factory and `/mcp/tools` manifest responses

### 2) McpToolManifestEntry
- **Fields**: `name`, `description`, `inputSchema`, `outputSchema`
- **Validation**: reflects actual registered tool definitions; no missing schema metadata
- **Used by**: `GET /mcp/tools`

### 3) McpInvokeRequest
- **Fields**: `tool`, `input`
- **Validation**: `tool` must exist in server registry; `input` must satisfy tool input schema
- **Used by**: `POST /mcp/invoke`

### 4) McpInvokeResponse
- **Fields (success)**: `output`, `durationMs`
- **Fields (failure)**: `error`, `code`, optional validation details
- **Validation**: output must pass tool output schema before response
- **Used by**: `POST /mcp/invoke`

### 5) CachePolicy
- **Fields**: `enabled`, `ttlSeconds`, `keyStrategy`, `staleAllowed`
- **Validation**: all policy values loaded from runtime config; no hardcoded TTL behavior
- **Used by**: cache-capable tools across servers

### 6) ProviderExecutionResult
- **Fields**: `provider`, `status`, `durationMs`, `payload`, optional `error`
- **Validation**: deterministic mapping of upstream timeout/errors to MCP structured error codes
- **Used by**: market-data, macro-signals, and news provider adapters

### 7) RetrievalQuery
- **Fields**: `query`, `limit`, optional `ticker`, optional `entryType`, optional `since`
- **Validation**: limit bounds and filter parsing validated at invoke boundary
- **Used by**: rag-retrieval search tools

### 8) RetrievalResultItem
- **Fields**: `id`, `ticker`, `entryType`, `score`, `summary`, `createdAt`
- **Validation**: ranked output order deterministic for equal inputs + same dataset
- **Used by**: rag-retrieval tool outputs

### 9) EnterpriseMockArtifact
- **Fields**: `id`, `sourceType`, `title`, `excerpt`, `timestamp`, `owner`
- **Validation**: fixtures remain deterministic and realistic; minimum corpus size enforced by tests
- **Used by**: enterprise-connector tools

### 10) TradeTicketState
- **Fields**: `ticketId`, `ticker`, `action`, `quantity`, `status`, `createdAt`, optional `filledPrice`
- **Validation**: status transitions valid; non-mock execution paths require explicit approval context
- **Used by**: trader-platform tools

## State Transitions

### MCP invoke lifecycle
1. `received` -> `validated-input`
2. `validated-input` -> `executed`
3. `executed` -> `validated-output`
4. `validated-output` -> `responded`
5. `received|validated-input|executed` -> `failed` (deterministic structured error)

### Cache lifecycle
1. `miss` -> `source-fetch` -> `cache-store` -> `hit`
2. `hit` -> `expired` (TTL elapsed)
3. `cache-error` -> `bypass` -> `source-fetch`

### Trader ticket lifecycle (mock mode)
1. `created` -> `placed`
2. `created` -> `cancelled`
3. `placed` -> `filled`
4. any non-mock execution request without approval context -> `rejected`
