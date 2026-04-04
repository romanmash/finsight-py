# Quickstart: MCP Platform

## Prerequisites

- Docker / Podman running
- PostgreSQL 16 with pgvector extension (`docker compose up -d postgres`)
- Redis 7 running (`docker compose up -d redis`)
- `.env` populated (copy from `.env.example`; set `OPENBB_API_KEY`, `FINNHUB_API_KEY`, `MCP_INTERNAL_SECRET`)
- `uv sync` completed

## Running (development — individual servers)

```bash
# Market data server (port 8101)
uv run uvicorn market_data.server:app --host 0.0.0.0 --port 8101 --app-dir apps/mcp-servers/market-data/src

# News-macro server (port 8102)
uv run uvicorn news_macro.server:app --host 0.0.0.0 --port 8102 --app-dir apps/mcp-servers/news-macro/src

# RAG retrieval server (port 8103)
uv run uvicorn rag_retrieval.server:app --host 0.0.0.0 --port 8103 --app-dir apps/mcp-servers/rag-retrieval/src
```

## Running (Docker Compose)

```bash
docker compose up -d mcp-market-data mcp-news-macro mcp-rag-retrieval
```

## Testing

```bash
# All MCP platform tests (offline, no network required)
uv run pytest apps/mcp-servers/ -v

# Individual server tests
uv run pytest apps/mcp-servers/market-data/tests/ -v
uv run pytest apps/mcp-servers/news-macro/tests/ -v
uv run pytest apps/mcp-servers/rag-retrieval/tests/ -v

# MCP client tests (in api app)
uv run pytest apps/api-service/tests/mcp/ -v

# Type check all MCP servers
uv run mypy --strict apps/mcp-servers/

# Lint
uv run ruff check apps/mcp-servers/
```

## Verifying

### Health endpoints

```bash
curl http://localhost:8101/health   # market-data
curl http://localhost:8102/health   # news-macro
curl http://localhost:8103/health   # rag-retrieval
```

Expected response (all three):
```json
{"status": "healthy", "server": "<name>", "dependencies": {"redis": "ok", "external_api": "ok"}}
```

### Tool discovery

```bash
# List tools on market-data server
curl -X POST http://localhost:8101/mcp \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $MCP_INTERNAL_SECRET" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Cache verification

```bash
# First call — cache miss (latency > 100ms)
curl -X POST http://localhost:8101/mcp \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $MCP_INTERNAL_SECRET" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_price","arguments":{"symbol":"AAPL"}}}'

# Second call within TTL — cache hit (metadata.cache_hit=true, latency_ms < 20)
curl -X POST http://localhost:8101/mcp \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $MCP_INTERNAL_SECRET" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_price","arguments":{"symbol":"AAPL"}}}'
```

### Fail-fast verification

Stop Redis and restart a server — it should exit with a non-zero code and print a descriptive error before accepting any requests.

```bash
docker compose stop redis
uv run uvicorn market_data.server:app --host 0.0.0.0 --port 8101 --app-dir apps/mcp-servers/market-data/src
# Expected: RuntimeError: Redis connection failed at startup. Exiting.
```
