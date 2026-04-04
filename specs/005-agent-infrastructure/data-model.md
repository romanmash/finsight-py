# Data Model: Agent Infrastructure

## AgentRun

**Type**: SQLAlchemy 2.x ORM model (defined in Feature 002 data layer; Feature 005 writes to it)
**Location**: `apps/api-service/src/api/db/models/agent_run.py` (Feature 002)

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | UUID | Primary key | auto-generated, server_default=uuid_generate_v4() |
| agent_name | str | Agent identifier (e.g., "watchdog", "researcher") | non-empty, indexed |
| mission_id | UUID | FK to missions.id | NOT NULL, FK |
| tokens_in | int | Input tokens consumed in this run | >= 0 |
| tokens_out | int | Output tokens generated in this run | >= 0 |
| cost_usd | Decimal | Computed cost using pricing registry | >= 0, precision 10, scale 6 |
| provider | str \| None | LLM provider identifier | nullable |
| model | str | Model name (e.g., "llama-3.2-3b", "gpt-4o") | non-empty |
| duration_ms | int \| None | Wall-clock run time in milliseconds | nullable, >= 0 |
| status | str | "running", "completed", "failed" | enum-like, non-empty |
| input_snapshot | dict \| None | Serialized input payload | nullable |
| output_snapshot | dict \| None | Serialized output payload | nullable |
| error_message | str \| None | Error message if status = "failed" | nullable |
| started_at | datetime | UTC run start timestamp | server_default=now() |
| completed_at | datetime \| None | UTC run completion timestamp | nullable |

**Relationships**: Many `AgentRun` records belong to one `Mission` (required FK).
**Indexes**: `(mission_id)`, `(agent_name)`, `(started_at DESC)`.

---

## AgentsConfig

**Type**: Pydantic v2 BaseModel
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
| input_cost_per_1k | float | Cost per 1000 input tokens in USD | >= 0 |
| output_cost_per_1k | float | Cost per 1000 output tokens in USD | >= 0 |

**YAML path**: `config/runtime/pricing.yaml`
**Validation rule**: unknown model keys return `(0.0, 0.0)` via `PricingConfig.get_cost(...)` and emit warning log.

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

    async def run(self, input_data: BaseModel, mission_id: UUID) -> BaseModel: ...

    @abstractmethod
    async def execute(self, input_data: BaseModel) -> BaseModel: ...
```

**run() contract**:
1. Record start time.
2. Call `execute()` (implemented by subclass).
3. Validate output against `output_type`.
4. On `ValidationError`: retry once with correction prompt.
5. On second failure: raise `AgentOutputError`.
6. On any exception: status = "failed".
7. Write `AgentRun` record to DB.
8. Return validated output.

---

## MCPClientConfig

**Type**: Section within `Mcp.servers` in `config/schemas/mcp.py` (shared with Feature 004)
**Location**: `config/runtime/mcp.yaml`

Consumed by `apps/api-service/src/api/mcp/client.py`. The client reads `servers` (HTTPS URL + timeout per server). Tool routing is internal prefix-based mapping in `MCPClient` (`market.*`, `news.*`, `macro.*`, `knowledge.*`). URLs must use `https://` per `McpServerConfig` validation.
