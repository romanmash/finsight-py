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
  lmstudio/llama-3.2-3b:
    input_cost_per_1k: 0.0
    output_cost_per_1k: 0.0
  openai/gpt-4o:
    input_cost_per_1k: 0.005
    output_cost_per_1k: 0.015
```

## Testing

```bash
# All agent infrastructure tests (offline, ~30s)
uv run pytest apps/api-service/tests/agents/ -v

# Just the base agent tests
uv run pytest apps/api-service/tests/agents/test_base.py -v

# Pricing registry tests
uv run pytest apps/api-service/tests/lib/test_pricing.py -v

# MCP client tests
uv run pytest apps/api-service/tests/mcp/test_client.py -v

# Type check
uv run mypy --strict apps/api-service/src/api/agents/base.py apps/api-service/src/api/lib/pricing.py apps/api-service/src/api/lib/tracing.py apps/api-service/src/api/mcp/client.py

# Lint
uv run ruff check apps/api-service/src/api/agents/ apps/api-service/src/api/lib/ apps/api-service/src/api/mcp/
```

## Verifying

### Verify cost calculation

```python
# In a Python REPL with uv run python
from api.lib.config import load_yaml_config
from api.lib.pricing import PricingRegistry
from config.schemas.pricing import PricingConfig
from pathlib import Path

pricing_cfg = load_yaml_config(Path("config/runtime/pricing.yaml"), PricingConfig)
registry = PricingRegistry(pricing_cfg)
cost = registry.compute_cost("openai/gpt-4o", tokens_in=1000, tokens_out=500)
print(cost)  # Decimal("0.012500")

# Unknown model — returns zero with warning
cost = registry.compute_cost("unknown-provider/unknown-model", tokens_in=100, tokens_out=50)
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
