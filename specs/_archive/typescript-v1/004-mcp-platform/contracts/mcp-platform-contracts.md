# Contract: MCP Platform Endpoints & Tool Surface (004)

## Base MCP Server Contract (applies to every MCP server)

### GET /health

- **Purpose**: liveness/readiness signal for one MCP service
- **Response 200**:

```json
{
  "status": "ok",
  "service": "market-data-mcp",
  "uptimeSeconds": 1234
}
```

### GET /mcp/tools

- **Purpose**: discover tool manifest with schemas
- **Response 200**:

```json
{
  "tools": [
    {
      "name": "get_quote",
      "description": "Get current quote for a ticker",
      "inputSchema": { "type": "object" },
      "outputSchema": { "type": "object" }
    }
  ]
}
```

### POST /mcp/invoke

- **Request**:

```json
{
  "tool": "get_quote",
  "input": { "ticker": "NVDA" }
}
```

- **Response 200**:

```json
{
  "output": {
    "ticker": "NVDA",
    "price": 0
  },
  "durationMs": 42
}
```

- **Response 400**: schema validation failure (input)
- **Response 404**: unknown tool
- **Response 500**: structured internal/tool failure

## Server-Specific Tool Contract Matrix

### market-data-mcp
- `get_quote`
- `get_ohlcv`
- `get_fundamentals`
- `get_earnings`
- `get_multiple_quotes`
- `get_analyst_ratings`
- `get_price_targets`

### macro-signals-mcp
- `get_gdelt_risk`
- `get_eco_calendar`
- `get_indicator`
- `get_sector_macro_context`

### news-mcp
- `get_ticker_news`
- `search_news`
- `get_sentiment_summary`
- `get_top_sentiment_shifts`
- `get_sector_movers`

### rag-retrieval-mcp
- `search`
- `get_current_thesis`
- `get_thesis_history`

### enterprise-connector-mcp
- `sharepoint_search`
- `search_emails`

### trader-platform-mcp
- `create_ticket`
- `get_ticket`
- `place_order`
- `cancel_ticket`

## Error Contract (deterministic)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input schema validation failed",
    "details": []
  }
}
```

Allowed error code families:
- `VALIDATION_ERROR`
- `TOOL_NOT_FOUND`
- `UPSTREAM_ERROR`
- `TIMEOUT`
- `CONFIG_ERROR`
- `AUTHORIZATION_ERROR`
- `INTERNAL_ERROR`

## Behavioral Constraints

- Input and output schema validation is mandatory for every tool invocation.
- Redis cache unavailability never causes process crash; cache-bypass behavior is required.
- Retrieval contract is read-only in this feature scope.
- Trader non-mock execution paths must require explicit approval context.
