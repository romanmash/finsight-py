# Contract: Agent Infrastructure Interfaces (005)

## Scope

Internal runtime contracts for:
- MCP tool initialization and invocation binding
- Model provider resolution and fallback
- Local-provider health probing

## 1) MCP Tool Initialization Contract

### Input

```json
{
  "servers": [
    {
      "name": "marketData",
      "url": "http://market-data-mcp:3001",
      "timeoutMs": 5000,
      "required": true
    }
  ]
}
```

### Output

```json
{
  "byServer": {
    "marketData": {
      "get_quote": "<tool-binding>"
    }
  },
  "all": {
    "get_quote": "<tool-binding>"
  },
  "initializedAt": "2026-03-31T00:00:00.000Z"
}
```

### Failure Semantics

- Required server unreachable -> initialization error with server name`r`n- Optional server unreachable -> warning emitted, server omitted from `byServer`, startup continues
- Manifest shape invalid -> validation error
- Tool-name collision in merged registry -> collision error

## 2) MCP Tool Invocation Binding Contract

### Request Shape

```json
{
  "tool": "get_quote",
  "input": {
    "ticker": "NVDA"
  }
}
```

### Success Envelope

```json
{
  "output": {},
  "durationMs": 42
}
```

### Failure Envelope

```json
{
  "error": {
    "code": "UPSTREAM_ERROR",
    "message": "...",
    "sourceServer": "marketData",
    "retryable": true
  },
  "durationMs": 42
}
```

### Error Codes

- `UPSTREAM_ERROR`: Tool call failed due to server/tool execution error.
- `TIMEOUT`: Tool call exceeded configured timeout.
- `VALIDATION_ERROR`: Tool input or output contract validation failed.
- `UNAVAILABLE`: Required server/tool unavailable.

## 3) Provider Resolution Contract

### Input

```json
{
  "agentName": "analyst",
  "localProviderAvailable": true,
  "overrides": {
    "temperature": 0.7
  }
}
```

### Output

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "effectiveTemperature": 0.7,
  "effectiveMaxTokens": 4096,
  "resolutionPath": "primary"
}
```

### Failure Semantics

- Unknown provider policy -> configuration error
- Primary unavailable with no fallback -> resolution error
- Override outside policy bounds -> validation error
- Deterministic selection order -> primary first, then one configured fallback, then error
- No tie-breaking by random scoring, latency race, or weighted selection in 005 scope

## 4) Local Provider Health Probe Contract

### Probe Result

```json
{
  "available": true,
  "checkedAt": "2026-03-31T00:00:00.000Z",
  "modelCount": 1
}
```

### Unavailable Result

```json
{
  "available": false,
  "checkedAt": "2026-03-31T00:00:00.000Z",
  "reason": "timeout"
}
```

### Behavioral Guarantees

- Probe uses bounded timeout
- Probe never throws unhandled errors to scheduler/boot caller
- Routing consumes latest successful snapshot semantics
- Snapshot older than 2x probe interval is stale and treated as unavailable for routing
