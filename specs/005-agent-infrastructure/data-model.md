# Data Model: Agent Infrastructure (005)

## Entity: McpServerDefinition

- **Purpose**: Represents one configured MCP server endpoint used during tool initialization.
- **Fields**:
  - `name` (string, unique)
  - `url` (string)
  - `timeoutMs` (number, positive)
  - `required` (boolean, for 005 all configured servers are required at startup)
- **Validation Rules**:
  - URL must be non-empty and valid
  - timeout must be within policy bounds

## Entity: ToolManifestEntry

- **Purpose**: Represents one tool published by an MCP server manifest.
- **Fields**:
  - `name` (string, unique per server)
  - `description` (string)
  - `inputSchemaDescriptor` (object)
  - `outputSchemaDescriptor` (object)
  - `sourceServer` (string)
- **Validation Rules**:
  - Name must be non-empty
  - Duplicate names across merged registry must trigger collision handling

## Entity: AgentToolRegistry

- **Purpose**: Runtime object containing per-server tool sets and one merged all-tools set.
- **Fields**:
  - `byServer` (map of server name -> tool set)
  - `all` (map of tool name -> tool binding)
  - `initializedAt` (timestamp)
- **Validation Rules**:
  - `all` contains no ambiguous tool mappings
  - Initialization considered invalid if required server manifests missing

## Entity: ProviderPolicy

- **Purpose**: Runtime policy for resolving provider/model settings for one agent.
- **Fields**:
  - `agentName` (string)
  - `primary` (provider/model/settings)
  - `fallback` (provider/model/settings, optional)
  - `overridePolicy` (bounds/rules)
- **Validation Rules**:
  - Primary must exist
  - Fallback optional but required for configured failover expectations

## Entity: ResolvedProviderProfile

- **Purpose**: Output of provider resolution used by agent invocation.
- **Fields**:
  - `provider` (enum-like string)
  - `model` (string)
  - `effectiveTemperature` (number)
  - `effectiveMaxTokens` (number)
  - `resolutionPath` (primary|fallback)
- **Validation Rules**:
  - Effective values obey policy bounds (`temperature` 0.0-1.0, `maxTokens` 1-8192, plus tighter policy-specific limits)
  - Resolution path deterministic for identical inputs + health state

## Entity: LocalProviderHealthSnapshot

- **Purpose**: Latest availability state for local-provider routing decisions.
- **Fields**:
  - `available` (boolean)
  - `checkedAt` (timestamp)
  - `staleAfterMs` (number, derived as 2x probe interval)
  - `reason` (string, optional)
  - `modelCount` (number, optional)
- **Validation Rules**:
  - Unreachable/timeout states produce `available=false` without exception propagation
  - Snapshot older than `staleAfterMs` is treated as unavailable for routing decisions

## State Transitions

1. **Tool Registry Lifecycle**:
   - `uninitialized` -> `initializing` -> `ready` | `failed`
2. **Provider Resolution Lifecycle**:
   - `requested` -> `primary_selected` | `fallback_selected` | `error`
3. **Local Provider Health Lifecycle**:
   - `unknown` -> `available` | `unavailable` -> periodic refresh transitions
   - `unavailable` -> `available` recovery occurs after successful subsequent probe
