# Data Model: MCP Platform

## ToolResponse

**Type**: Pydantic generic model (defined independently per server)  
**Locations**:
- `apps/mcp-servers/market-data/src/market_data/models.py`
- `apps/mcp-servers/news-macro/src/news_macro/models.py`
- `apps/mcp-servers/rag-retrieval/src/rag_retrieval/models.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| data | T \| None | Typed tool payload; None on error | generic param T |
| error | str \| None | Error text; None on success | |
| cache_hit | bool | True if served from cache | default False |
| latency_ms | int | Tool call wall-clock latency | >= 0 |

---

## CacheEntry

**Type**: Redis key-value (JSON)
**Location**: Redis namespace `mcp:{server}:{tool}:{params_hash}`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| key | str | `mcp:{server}:{tool}:{sha256(sorted_params)[:16]}` | Redis key |
| value | str | JSON-serialized tool payload (`data`) | |
| ttl | int | Seconds until expiry, loaded from `mcp.yaml` | > 0 |

**Note**: Only successful `data` payloads are cached. `error` responses are not cached.

---

## MCP Runtime Config

**Type**: Pydantic v2 model  
**Location**: `config/schemas/mcp.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| servers | dict[str, McpServerConfig] | Server map keyed by server id | keys: `market-data`, `news-macro`, `rag-retrieval` |

### McpServerConfig

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| url | str | MCP server base URL | valid URL |
| timeout_seconds | int | Per-call timeout | 1-300 |
| cache_ttl_seconds | int | Default server TTL | > 0 |
| openbb_provider | str \| None | Market-data provider override | optional |
| tools | dict[str, ToolCacheConfig] \| None | Optional per-tool TTL map | optional |

### ToolCacheConfig

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| cache_ttl_seconds | int | Per-tool TTL override | > 0 |

**YAML path**: `config/runtime/mcp.yaml`

---

## Market Data Payloads

**Location**: `apps/mcp-servers/market-data/src/market_data/models.py`

### PriceData

| Field | Type | Description |
|-------|------|-------------|
| symbol | str | Ticker symbol |
| price | Decimal | Last price |
| change_pct | float | Daily percentage move |
| volume | int | Trading volume |
| timestamp | datetime | Quote timestamp |

### OHLCVBar

| Field | Type | Description |
|-------|------|-------------|
| date | date | Trading date |
| open | Decimal | Open price |
| high | Decimal | High price |
| low | Decimal | Low price |
| close | Decimal | Close price |
| volume | int | Trading volume |

### FundamentalsData / ETFData / OptionsData

Structured records as defined in `tasks.md` T013 (market cap/PE/EPS, ETF holdings, options contracts).

---

## News and Macro Payloads

**Location**: `apps/mcp-servers/news-macro/src/news_macro/models.py`

### NewsItem

headline/source/url/published_at/relevance/summary.

### SentimentData

symbol/score/label/as_of.

### MacroSignals

market_sentiment/volatility_regime/geopolitical_risk_index/updated_at.

---

## RAG Retrieval Payloads

**Location**: `apps/mcp-servers/rag-retrieval/src/rag_retrieval/models.py`

### KnowledgeResult

id/content/source_type/author_agent/confidence/tickers/tags/freshness_date/similarity_score.

### Runtime dependency

RAG retrieval reads from `knowledge_entries` in PostgreSQL/pgvector. If the table is missing at
startup, the rag-retrieval server must fail fast with `SystemExit(1)` and a clear dependency error.
