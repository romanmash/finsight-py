"""
WatchdogAgent — Threshold Evaluator

This agent makes no LLM calls. Alert descriptions are generated programmatically
from observed values and configured thresholds.

Threshold evaluation logic:
- Price: abs(current_price - prev_close) / prev_close >= threshold_pct / 100
- Volume: current_volume >= avg_volume * multiplier
- News: articles_per_hour >= news_spike_rate_per_hour threshold

Per-item thresholds (WatchlistItem columns) take precedence over watchdog.yaml defaults.
Null per-item threshold falls back to watchdog.yaml default.
"""
