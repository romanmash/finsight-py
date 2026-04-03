# Data Model: Foundation & Config

**Feature**: `001-python-foundation-config` | **Date**: 2026-04-02

This feature does not introduce persistent database entities. It establishes the configuration
schema models (Pydantic v2 `BaseModel`) that govern system startup and runtime behaviour.

---

## Configuration Schema Models

All models live in `config/schemas/`. They are pure Pydantic v2 `BaseModel` classes with no
SQLAlchemy dependency. They are loaded at startup and immutable at runtime.

### AgentsConfig (`config/schemas/agents.py`)

Governs all 7 agent definitions: model selection, temperature, token limits, retry policy.

```
AgentsConfig
├── agents: dict[str, AgentConfig]     # key = agent name (manager, watchdog, etc.)

AgentConfig
├── model: str                         # e.g. "gpt-4o-mini"
├── provider: str                      # "openai" | "anthropic" | "local"
├── temperature: float                 # 0.0–2.0
├── max_tokens: int                    # output token limit
├── max_retries: int                   # on transient failure
├── timeout_seconds: int               # per-call timeout
└── system_prompt_file: str | None     # optional override path
```

### McpConfig (`config/schemas/mcp.py`)

Governs the 3 FastMCP server URLs, timeouts, and cache TTLs.

```
McpConfig
├── servers: dict[str, McpServerConfig]  # key = server name

McpServerConfig
├── url: str                             # e.g. "http://market-data-mcp:8001"
├── timeout_seconds: int
└── cache_ttl_seconds: int
```

### PricingConfig (`config/schemas/pricing.py`)

Maps (provider, model) pairs to per-token costs. Used by cost tracking.

```
PricingConfig
├── models: dict[str, ModelPricing]      # key = "provider/model-name"

ModelPricing
├── input_cost_per_1k: float             # USD per 1,000 input tokens
└── output_cost_per_1k: float            # USD per 1,000 output tokens
```

Unknown models default to `0.00` with a warning log — never block startup.

### WatchdogConfig (`config/schemas/watchdog.py`)

Governs the Watchdog agent's polling intervals and alert thresholds.

```
WatchdogConfig
├── poll_interval_seconds: int
├── alert_cooldown_seconds: int
└── default_thresholds: ThresholdDefaults

ThresholdDefaults
├── price_change_pct: float
├── volume_spike_multiplier: float
└── rsi_overbought: float
```

### SchedulerConfig (`config/schemas/scheduler.py`)

Governs Celery beat schedule for background workers.

```
SchedulerConfig
├── screener_cron: str       # cron expression, e.g. "0 6 * * 1-5"
├── brief_cron: str          # daily brief generation time
├── earnings_lookback_days: int
└── timezone: str            # e.g. "Europe/London"
```

---

## Environment Config Model (`apps/api/src/api/lib/config.py`)

This is a `pydantic-settings` `BaseSettings` class that reads from `.env`. It holds only secrets
and environment-specific values — nothing behavioural.

```
Settings (BaseSettings)
├── database_url: PostgresDsn          # e.g. postgresql+asyncpg://...
├── redis_url: RedisDsn                # e.g. redis://localhost:6379/0
├── openai_api_key: SecretStr
├── anthropic_api_key: SecretStr | None
├── finnhub_api_key: SecretStr | None
├── telegram_bot_token: SecretStr | None
├── secret_key: SecretStr              # used by Feature 003 for JWT signing
├── environment: Literal["dev","staging","prod"]
└── log_level: Literal["DEBUG","INFO","WARNING","ERROR"]
```

All fields with `SecretStr` are never logged or serialised. `model_config = SettingsConfigDict(env_file=".env", extra="ignore")`.

---

## Health Status (runtime-only, no DB)

```
HealthStatus
├── status: Literal["healthy", "degraded", "unhealthy"]
├── database: SubsystemStatus
├── cache: SubsystemStatus
└── config: SubsystemStatus

SubsystemStatus
├── status: Literal["ok", "error"]
└── detail: str | None
```

No database table — this is constructed fresh on every `/health` request.
