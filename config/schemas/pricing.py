"""Pricing runtime schema."""

from __future__ import annotations

import structlog
from pydantic import BaseModel, ConfigDict

logger = structlog.get_logger(__name__)


class ModelPricing(BaseModel):
    model_config = ConfigDict(frozen=True)

    input_cost_per_1k: float
    output_cost_per_1k: float


class PricingConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    models: dict[str, ModelPricing]

    def get_cost(self, provider: str, model: str) -> tuple[float, float]:
        key = f"{provider}/{model}"
        pricing = self.models.get(key)
        if pricing is None:
            logger.warning("unknown_model_pricing", provider=provider, model=model)
            return (0.0, 0.0)
        return (pricing.input_cost_per_1k, pricing.output_cost_per_1k)
