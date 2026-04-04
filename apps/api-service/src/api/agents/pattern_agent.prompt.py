"""Technician (pattern specialist) prompt module."""

from __future__ import annotations

from finsight.shared.models import OHLCVBar

from api.agents.shared.prompts import (
    ANALYSIS_CONSTRAINTS,
    OUTPUT_FORMAT_INSTRUCTIONS,
    SYSTEM_ROLE_PREAMBLE,
)

PATTERN_SYSTEM_PROMPT = (
    f"{SYSTEM_ROLE_PREAMBLE}\n"
    "You are the Technician (Pattern Specialist). Identify technical structure "
    "from OHLCV data only.\n"
    f"{ANALYSIS_CONSTRAINTS}\n"
    "Do not provide investment advice, buy/sell calls, price targets, entry, or exit points. "
    "If no clear structure exists, return NO_PATTERN and explain why.\n"
    f"{OUTPUT_FORMAT_INSTRUCTIONS}"
)


def build_user_prompt(price_history: list[OHLCVBar], ticker: str) -> str:
    rows = [
        f"{bar.date.isoformat()} o={bar.open} h={bar.high} l={bar.low} c={bar.close} v={bar.volume}"
        for bar in price_history[-30:]
    ]
    table = "\n".join(rows) if rows else "(none)"
    return (
        f"Ticker: {ticker}\n"
        f"Bars supplied: {len(price_history)}\n"
        "OHLCV sample (oldest->newest):\n"
        f"{table}\n"
        "Return PatternReport with pattern_type, pattern_name, confidence, "
        "observations, timeframe, and no_pattern_rationale when needed."
    )
