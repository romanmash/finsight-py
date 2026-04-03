# Quickstart: Agent Infrastructure

## Prerequisites

- Feature 002 (data layer) migrations applied: `uv run alembic upgrade head`
- Feature 004 (MCP platform) servers running (or tests run offline with mocks)
- `.env` populated with `DATABASE_URL`, `REDIS_URL`, `LANGCHAIN_API_KEY` (optional for tracing)
- `uv sync` completed

## Configuration

Edit `config/runtime/agents.yaml` to set the model per agent:

```yaml
agents:
  watchdog:
    provider: lmstudio
    model: llama-3.2-3b
    temperature: 0.0
    max_tokens: 1024
  researcher:
    provider: lmstudio
    model: llama-3.2-3b
    temperature: 0.0
    max_tokens: 2048
```

Edit `config/runtime/pricing.yaml` to set token costs:

```yaml
models:
  llama-3.2-3b:
    provider: lmstudio
    input_per_1k_tokens: 0.0
    output_per_1k_tokens: 0.0
  gpt-4o:
    provider: openai
    input_per_1k_tokens: 0.005
    output_per_1k_tokens: 0.015
```

## Testing

```bash
# All agent infrastructure tests (offline, ~30s)
uv run pytest apps/api/tests/agents/ -v

# Just the base agent tests
uv run pytest apps/api/tests/agents/test_base.py -v

# Pricing registry tests
uv run pytest apps/api/tests/lib/test_pricing.py -v

# MCP client tests
uv run pytest apps/api/tests/mcp/test_client.py -v

# Type check
uv run mypy --strict apps/api/src/api/agents/base.py apps/api/src/api/lib/pricing.py apps/api/src/api/lib/tracing.py apps/api/src/api/mcp/client.py

# Lint
uv run ruff check apps/api/src/api/agents/ apps/api/src/api/lib/ apps/api/src/api/mcp/
```

## Verifying

### Verify cost calculation

```python
# In a Python REPL with uv run python
from api.lib.pricing import PricingRegistry
from pathlib import Path

registry = PricingRegistry.from_yaml(Path("config/runtime/pricing.yaml"))
cost = registry.compute_cost("gpt-4o", tokens_in=1000, tokens_out=500)
print(cost)  # Decimal("0.012500")

# Unknown model — returns zero with warning
cost = registry.compute_cost("unknown-model-xyz", tokens_in=100, tokens_out=50)
print(cost)  # Decimal("0.000000")
```

### Verify AgentRun record creation (requires running DB)

```bash
uv run python -c "
import asyncio
from api.agents.base import BaseAgent
# ... instantiate a test agent and call run(); check DB for AgentRun record
"
```

### LangSmith tracing (optional)

Set in `.env`:
```
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__your_key_here
LANGCHAIN_PROJECT=finsight-dev
```

Run an agent and check https://smith.langchain.com for traces in the `finsight-dev` project.
