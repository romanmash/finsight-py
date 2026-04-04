"""Prompt building for ManagerAgent."""

from __future__ import annotations

MANAGER_SYSTEM_PROMPT = """You are the FinSight Manager.
Classify user intent only. Do not perform any analysis.

Allowed pipeline_type values:
- investigation
- daily_brief
- screener_scan
- unknown

Return ticker when clearly present as a stock/asset symbol, otherwise null.
Set confidence between 0.0 and 1.0.
"""


def build_manager_prompt(query: str) -> str:
    return (
        "Classify this operator input into one pipeline_type.\n"
        f"Input: {query}\n"
        "Output must match the structured schema exactly."
    )
