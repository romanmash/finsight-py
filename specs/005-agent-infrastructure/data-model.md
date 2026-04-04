# Data Model: Agent Infrastructure

## AgentRun

**Type**: SQLAlchemy 2.x ORM model (defined in Feature 002 data layer; Feature 005 writes to it)
**Location**: `apps/api-service/src/api/db/models/agent_run.py` (Feature 002)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | UUID | Primary key | auto-generated, server_default=uuid_generate_v4() |
| agent_name | str | Agent identifier (e.g., "watchdog", "researcher") | non-empty, indexed |
| mission_id | UUID \| None | FK to missions.id; None for standalone runs | nullable, FK |
| tokens_in | int | Input tokens consumed in this run | >= 0 |
| tokens_out | int | Output tokens generated in this run | >= 0 |
| cost_usd | Decimal | Computed cost using pricing registry | >= 0, precision 10, scale 6 |
| provider | str | LLM provider (e.g., "lmstudio", "openai", "anthropic") | non-empty |
| model | str | Model name (e.g., "llama-3.2-3b", "gpt-4o") | non-empty |
| duration_ms | int | Wall-clock run time in milliseconds | >= 0 |
| status | str | "success", "failed", "retry_failed" | enum-like, non-empty |
| error | str \| None | Error message if status != "success" | nullable |
| output_json | str \| None | JSON-serialized agent output (for debugging) | nullable |
| created_at | datetime | UTC run start timestamp | server_default=now() |

**Relationships**: Many `AgentRun` records belong to one `Mission` (nullable FK).
**Indexes**: `(agent_name, created_at)`, `(mission_id)`.

---

## AgentsConfig

**Type**: Pydantic v2 BaseSettings model
**Location**: `config/schemas/agents.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| agents | dict[str, AgentModelConfig] | Map of agent name to model config | |

### AgentModelConfig (nested)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| provider | str | Primary LLM provider identifier | non-empty |
| model | str | Primary model name | non-empty |
| fallback_provider | str \| None | Fallback provider if primary unavailable | nullable |
| fallback_model | str \| None | Fallback model name | nullable |
| temperature | float | Sampling temperature | 0.0–2.0, default 0.0 |
| max_tokens | int | Maximum output tokens | 1–32768, default 2048 |

**YAML path**: `config/runtime/agents.yaml`

---

## PricingConfig

**Type**: Pydantic v2 BaseModel
**Location**: `config/schemas/pricing.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| models | dict[str, ModelPricing] | Map of model name to pricing | |

### ModelPricing (nested)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| provider | str | Provider identifier | non-empty |
| input_per_1k_tokens | Decimal | Cost per 1000 input tokens in USD | >= 0 |
| output_per_1k_tokens | Decimal | Cost per 1000 output tokens in USD | >= 0 |

**YAML path**: `config/runtime/pricing.yaml`
**Validation rule**: `model_validator` logs warning and returns `Decimal("0.00")` for any model key not present in `models` dict. Never raises.

---

## LLMCallRecord

**Type**: Pydantic model (in-memory, accumulated during a run, flushed to AgentRun on completion)
**Location**: `apps/api-service/src/api/agents/base.py`

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| call_index | int | Sequential index within the run | >= 0 |
| tokens_in | int | Input tokens for this call | >= 0 |
| tokens_out | int | Output tokens for this call | >= 0 |
| cost_usd | Decimal | Computed cost for this call | >= 0 |
| duration_ms | int | Latency for this call | >= 0 |
| model | str | Model used | non-empty |
| provider | str | Provider used | non-empty |

**Note**: `LLMCallRecord` is not persisted separately. The `AgentRun` stores the summed totals across all calls in a single run.

---

## BaseAgent (abstract class interface)

**Type**: Python abstract class
**Location**: `apps/api-service/src/api/agents/base.py`

### Key method signatures

```python
class BaseAgent(ABC):
    agent_name: ClassVar[str]               # overridden by each agent
    input_type: ClassVar[type[BaseModel]]   # Pydantic input schema
    output_type: ClassVar[type[BaseModel]]  # Pydantic output schema

    def __init__(self, config: AgentsConfig, pricing: PricingConfig, mcp_client: MCPClient, db_session: AsyncSession) -> None: ...

    async def run(self, input_data: BaseModel, mission_id: UUID | None = None) -> BaseModel: ...

    @abstractmethod
    async def execute(self, input_data: BaseModel) -> BaseModel: ...
```

**run() contract**:
1. Record start time.
2. Call `execute()` (implemented by subclass).
3. Validate output against `output_type`.
4. On `ValidationError`: retry once with correction prompt.
5. On second failure: raise `AgentOutputValidationError`.
6. On any exception: status = "failed".
7. Write `AgentRun` record to DB.
8. Return validated output.

---

## MCPClientConfig

**Type**: Section within `Mcp.servers` in `config/schemas/mcp.py` (shared with Feature 004)
**Location**: `config/runtime/mcp.yaml`

Consumed by `apps/api-service/src/api/mcp/client.py`. The client reads `servers` (URL + timeout per server) and `tool_routing` (tool name → server name mapping) at startup.

### ToolRouting entry (in mcp.yaml)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| tool_name | str | Name of the MCP tool | non-empty |
| server | str | Server identifier | one of "market-data", "news-macro", "rag-retrieval" |
