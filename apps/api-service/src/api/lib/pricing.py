"""Pricing registry for model usage cost calculation."""

from __future__ import annotations

from decimal import Decimal

import structlog

from api.lib.config import AllConfigs
from config.schemas.pricing import PricingConfig

logger = structlog.get_logger(__name__)


class PricingRegistry:
    """Compute token usage cost from runtime pricing configuration."""

    def __init__(self, config: PricingConfig) -> None:
        self._config = config

    def compute_cost(self, model: str, tokens_in: int, tokens_out: int) -> Decimal:
        pricing = self._config.models.get(model)
        if pricing is None and "/" not in model:
            # Backward-compatible lookup when caller passes model name only.
            for key, configured in self._config.models.items():
                _, _, configured_model = key.partition("/")
                if configured_model == model:
                    pricing = configured
                    break

        if pricing is None:
            logger.warning("unknown_model_in_pricing_registry", model=model)
            return Decimal("0.00")

        input_cost = (
            Decimal(str(tokens_in)) * Decimal(str(pricing.input_cost_per_1k)) / Decimal("1000")
        )
        output_cost = (
            Decimal(str(tokens_out)) * Decimal(str(pricing.output_cost_per_1k)) / Decimal("1000")
        )
        return input_cost + output_cost


def get_registry(configs: AllConfigs) -> PricingRegistry:
    """Create a pricing registry from loaded runtime config bundle."""
    return PricingRegistry(configs.pricing)
