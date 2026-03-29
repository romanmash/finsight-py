# Feature Specification: Agent Infrastructure

**Feature**: `005-agent-infrastructure`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/constitution.md`](../../.specify/constitution.md)
**Depends on**: `003-api-auth`, `004-mcp-platform`

## Overview

Create the MCP Client that registers all 6 MCP server tool manifests as Vercel AI SDK `tool()` bindings at startup, and create the Model Router that resolves the correct LLM provider client per agent based on `agents.yaml` config with automatic fallback handling and LM Studio health probing.

**Why this feature exists:** Every agent needs two things to function: (1) tools from MCP servers to access external data, and (2) a correctly configured LLM provider to generate responses. This feature is the bridge between the MCP server platform and the agent layer — without it, agents have no tools and no model.

---

## User Scenarios & Testing

### User Story 1 — MCP Client Tool Registration (Priority: P1)

As an agent, I want all MCP server tools available as Vercel AI SDK `tool()` bindings so that I can call external data sources using the standard AI SDK `generateText` tool calling interface.

**Why P1**: Every agent that uses tools (Researcher, Watchdog, Screener, Technician, Trader) depends on this. Without it, agents can't access any external data.

**Independent Test**: Start all 6 MCP servers, call `initMcpClients(config)`, verify the returned `McpToolSets` object contains tool bindings for all servers and that calling a tool executes correctly.

**Acceptance Scenarios**:

1. **Given** all 6 MCP servers are running, **When** `initMcpClients(config)` is called, **Then** it returns `McpToolSets` with tool sets for all 6 servers
2. **Given** `McpToolSets.marketData` is populated, **When** the `get_quote` tool is executed with `{ ticker: 'NVDA' }`, **Then** it calls `POST /mcp/invoke` on `market-data-mcp:3001` and returns the result
3. **Given** `McpToolSets.all` is requested, **Then** it contains merged tools from all 6 servers (used by Researcher who needs access to everything)
4. **Given** one MCP server is unreachable at startup, **When** `initMcpClients()` is called, **Then** it throws with a clear error message naming the unreachable server
5. **Given** a tool call fails at runtime, **Then** the error is caught and returned as a tool result error (not thrown unhandled)

---

### User Story 2 — Model Router (Priority: P1)

As an agent, I want the correct LLM provider client resolved for me based on config so that I use the right model (Anthropic, OpenAI, Azure, or LM Studio) with the correct temperature and token limits.

**Why P1**: Without model routing, agents can't make LLM calls. The multi-provider strategy is a key demo feature showing the system's flexibility.

**Independent Test**: Call `resolveProvider('analyst', config, true)` and verify it returns the Anthropic client with Claude Sonnet model and correct temperature.

**Acceptance Scenarios**:

1. **Given** `agents.yaml` defines Manager as `anthropic / claude-sonnet`, **When** `resolveProvider('manager', config, true)` is called, **Then** it returns a `ResolvedProvider` with `provider: 'anthropic'`, `model: 'claude-sonnet-4-20250514'`, `temperature: 0.2`
2. **Given** Reporter's primary is `lmstudio` and LM Studio is available, **When** `resolveProvider('reporter', config, true)` is called, **Then** it returns the LM Studio client
3. **Given** Reporter's primary is `lmstudio` and LM Studio is NOT available, **When** `resolveProvider('reporter', config, false)` is called, **Then** it returns the fallback OpenAI gpt-4o-mini client
4. **Given** Analyst in devil's advocate mode, **When** `resolveProvider('analyst', config, true, { temperature: 0.7 })` is called, **Then** the returned provider has `temperature: 0.7` (override applied)
5. **Given** an agent has no fallback configured and the primary is unavailable, **When** `resolveProvider()` is called, **Then** it throws with a clear error

---

### User Story 3 — LM Studio Health Probing (Priority: P2)

As the system, I want periodic LM Studio availability checks so that the model router can make real-time fallback decisions.

**Why P2**: The system works with cloud-only providers. LM Studio probing is an optimization to enable free local inference when available.

**Independent Test**: Start LM Studio, call `probeLmStudio(url)`, verify it returns `true`. Stop LM Studio, verify it returns `false`.

**Acceptance Scenarios**:

1. **Given** LM Studio is running at `http://localhost:1234`, **When** `probeLmStudio('http://localhost:1234')` is called, **Then** it returns `true`
2. **Given** LM Studio is not running, **When** `probeLmStudio()` is called with a 3-second timeout, **Then** it returns `false` without throwing
3. **Given** the system is running, **Then** LM Studio probing occurs on startup and every 5 minutes thereafter (interval configurable)

---

### Edge Cases

- What if LM Studio returns 200 but has no models loaded? → `probeLmStudio` checks `GET /v1/models` response — if empty, returns `false`
- What if an agent's provider config references an unknown provider? → `resolveProvider` throws with descriptive error mentioning the agent name and provider
- What if tool manifest changes after startup (server redeployed)? → Tools are registered at startup only — restart API to pick up changes
- What if Vercel AI SDK tool execution times out? → MCP server's `timeoutMs` from `mcp.yaml` applies — tool returns timeout error

---

## Requirements

### Functional Requirements

#### MCP Client
- **FR-001**: `initMcpClients(config)` MUST fetch `GET /mcp/tools` from all 6 MCP servers at startup
- **FR-002**: For each tool in the manifest, MUST create a Vercel AI SDK `tool()` with the declared `inputSchema`
- **FR-003**: Each tool's execute function MUST call `POST /mcp/invoke { tool: name, input }` on the MCP server
- **FR-004**: If any MCP server is unreachable at startup, `initMcpClients` MUST throw with clear error (fail-fast)
- **FR-005**: `McpToolSets.all` MUST be a merged record of all tools from all 6 servers
- **FR-006**: Tool execution errors MUST be returned as structured results, not thrown

#### Model Router
- **FR-007**: `resolveProvider(agentName, config, lmStudioAvailable, modeOverride?)` MUST return `ResolvedProvider`
- **FR-008**: If primary provider is `lmstudio` and `lmStudioAvailable` is false, MUST fall back to `fallback` config
- **FR-009**: If no fallback is configured and primary is unavailable, MUST throw descriptive error
- **FR-010**: `modeOverride.temperature` MUST override the configured temperature (used for devil's advocate mode)
- **FR-011**: `probeLmStudio(baseUrl)` MUST call `GET /v1/models`, return `true` if response contains at least one model, `false` on error or timeout
- **FR-012**: LM Studio probe MUST timeout after 3 seconds (never block startup)
- **FR-013**: LM Studio probe MUST run on startup and repeat every 5 minutes

### Key Entities

```typescript
interface McpToolSets {
  marketData: Record<string, ReturnType<typeof tool>>;
  macroSignals: Record<string, ReturnType<typeof tool>>;
  news: Record<string, ReturnType<typeof tool>>;
  ragRetrieval: Record<string, ReturnType<typeof tool>>;
  enterpriseConnector: Record<string, ReturnType<typeof tool>>;
  traderPlatform: Record<string, ReturnType<typeof tool>>;
  all: Record<string, ReturnType<typeof tool>>;  // merged
}

interface ResolvedProvider {
  client: LanguageModelV1;  // Vercel AI SDK provider
  model: string;
  provider: Provider;
  temperature: number;
  maxTokens: number;
}
```

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `initMcpClients` succeeds when all 6 MCP servers are running
- **SC-002**: `initMcpClients` throws with clear error when any server is unreachable
- **SC-003**: `resolveProvider('analyst', config, true)` returns anthropic client with correct settings
- **SC-004**: `resolveProvider('reporter', config, false)` returns fallback openai client
- **SC-005**: `resolveProvider('analyst', config, true, { temperature: 0.7 })` returns correct temperature override
- **SC-006**: `probeLmStudio` returns `true` when LM Studio is running, `false` when not
- **SC-007**: All unit tests pass without any external services running (mocked HTTP)
