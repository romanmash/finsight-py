# Data Model: MCP Platform

## ToolResponse

**Type**: Pydantic generic model (shared)
**Location**: `packages/shared/src/finsight/shared/models/tool_response.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| data | T \| None | Typed tool payload; None on error | generic param T |
| error | ToolError \| None | Structured error descriptor; None on success | |
| metadata | ToolCallMetadata | Call provenance and performance info | required |

**Validation rules**: Exactly one of `data` or `error` must be non-None. Enforced via `model_validator(mode="after")`.

---

## ToolError

**Type**: Pydantic model (shared)
**Location**: `packages/shared/src/finsight/shared/models/tool_response.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| code | str | Machine-readable error code (e.g., "TIMEOUT", "INVALID_SYMBOL") | non-empty |
| message | str | Human-readable error description | non-empty |
| tool_name | str | Name of the tool that failed | non-empty |

---

## ToolCallMetadata

**Type**: Pydantic model (shared)
**Location**: `packages/shared/src/finsight/shared/models/tool_response.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| tool_name | str | Name of the called tool | non-empty |
| server | str | Server identifier ("market-data", "news-macro", "rag-retrieval") | non-empty |
| cache_hit | bool | True if result served from cache | |
| latency_ms | int | Wall-clock time for the call in milliseconds | >= 0 |
| called_at | datetime | UTC timestamp of the tool call | |

---

## CacheEntry

**Type**: Redis key-value (not a Pydantic model — stored as JSON string)
**Location**: Redis namespace `mcp:{server}:{tool_name}:{params_hash}`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| key | str | `mcp:{server}:{tool_name}:{sha256(sorted_params)}` | Redis key |
| value | str | JSON-serialized `ToolResponse` payload (data field only) | |
| ttl | int | Seconds until expiry; set on write, defined in mcp.yaml | > 0 |

**Note**: Only the `data` field is cached (not `metadata` or `error`). On cache hit, `metadata.cache_hit = True` and `metadata.latency_ms` reflects cache retrieval time only.

---

## MCP Server Configuration

**Type**: Pydantic v2 Settings model
**Location**: `config/schemas/mcp.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| servers | dict[str, ServerConfig] | Map of server name to config | keys: "market-data", "news-macro", "rag-retrieval" |
| tool_ttls | dict[str, int] | Per-tool cache TTL in seconds | values > 0 |

### ServerConfig (nested)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| url | str | Base URL of the MCP server | valid URL |
| timeout_seconds | int | HTTP client timeout per call | 1–300 |
| internal_secret | str | Loaded from env var reference | from .env |

**YAML path**: `config/runtime/mcp.yaml`

---

## Market Data Tool Payloads (Pydantic models in market-data server)

**Location**: `apps/mcp-servers/market-data/src/market_data/models.py`

### PriceBar

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| symbol | str | Ticker symbol | non-empty |
| date | date | Bar date | |
| open | Decimal | Opening price | > 0 |
| high | Decimal | High price | >= open |
| low | Decimal | Low price | <= open, > 0 |
| close | Decimal | Closing price | > 0 |
| volume | int | Trading volume | >= 0 |

### FundamentalData

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| symbol | str | Ticker symbol | non-empty |
| market_cap | Decimal \| None | Market capitalisation USD | nullable |
| pe_ratio | Decimal \| None | Price-to-earnings ratio | nullable |
| eps | Decimal \| None | Earnings per share | nullable |
| revenue_ttm | Decimal \| None | Trailing 12-month revenue USD | nullable |
| fetched_at | datetime | UTC fetch timestamp | |

### ETFHolding

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| etf_symbol | str | ETF ticker | non-empty |
| holding_symbol | str | Constituent ticker | non-empty |
| weight | Decimal | Portfolio weight 0–1 | 0 <= weight <= 1 |
| name | str \| None | Constituent name | nullable |

---

## News and Macro Tool Payloads (Pydantic models in news-macro server)

**Location**: `apps/mcp-servers/news-macro/src/news_macro/models.py`

### NewsItem

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | str | Source-assigned article ID | non-empty |
| source | str | Data source identifier (e.g., "finnhub") | non-empty |
| headline | str | Article headline | non-empty |
| summary | str \| None | Article summary or lead paragraph | nullable |
| url | str \| None | Article URL | nullable |
| published_at | datetime | UTC publication timestamp | |
| relevance_score | float \| None | Source-provided relevance 0–1 | nullable, 0–1 |
| symbols | list[str] | Related ticker symbols | |

### MacroSignal

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| indicator | str | Signal name (e.g., "vix", "geopolitical_risk_index") | non-empty |
| value | float | Current indicator value | |
| source | str | Data source identifier | non-empty |
| as_of | datetime | Timestamp of the reading | |
| description | str \| None | Human-readable indicator description | nullable |

---

## RAG Retrieval Tool Payloads (Pydantic models in rag-retrieval server)

**Location**: `apps/mcp-servers/rag-retrieval/src/rag_retrieval/models.py`

### KnowledgeEntry

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | UUID | Entry primary key | |
| content | str | Text content of the entry | non-empty |
| source_agent | str | Agent that created the entry | non-empty |
| entity_symbols | list[str] | Related ticker symbols | |
| entry_type | str | Classification (e.g., "analyst_note", "brief") | non-empty |
| created_at | datetime | UTC creation timestamp | |
| similarity_score | float \| None | Cosine similarity to query (populated on search) | nullable, 0–1 |

### RetrievalQuery (tool input)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| query | str | Natural-language query text | non-empty |
| top_k | int | Maximum results to return | 1–100, default 10 |
| source_agent | str \| None | Filter by creating agent | nullable |
| symbol | str \| None | Filter by related symbol | nullable |
| from_date | date \| None | Filter entries created on or after | nullable |
| to_date | date \| None | Filter entries created on or before | nullable |
