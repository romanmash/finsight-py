"""Analyst agent prompt module."""

from __future__ import annotations

from finsight.shared.models import ResearchPacket

from api.agents.shared.prompts import (
    ANALYSIS_CONSTRAINTS,
    OUTPUT_FORMAT_INSTRUCTIONS,
    SYSTEM_ROLE_PREAMBLE,
)

ANALYST_SYSTEM_PROMPT = (
    f"{SYSTEM_ROLE_PREAMBLE}\n"
    "You are the Analyst agent. Synthesize only the evidence in the provided ResearchPacket. "
    "Do not call tools or fetch additional data.\n"
    f"{ANALYSIS_CONSTRAINTS}\n"
    "Assess thesis support, contradictory evidence, and key risks with explicit uncertainty.\n"
    f"{OUTPUT_FORMAT_INSTRUCTIONS}"
)


def build_user_prompt(packet: ResearchPacket) -> str:
    price_rows = []
    if packet.price_history is not None:
        for bar in packet.price_history[-20:]:
            price_rows.append(
                f"{bar.date.isoformat()} o={bar.open} h={bar.high} "
                f"l={bar.low} c={bar.close} v={bar.volume}"
            )

    news_lines = [
        f"- {item.headline}" if item.summary is None else f"- {item.headline}: {item.summary}"
        for item in packet.news_items[:12]
    ]
    kb_lines = [entry.content for entry in packet.kb_entries[:10]]
    fundamentals_text = (
        packet.fundamentals.model_dump(mode="json")
        if packet.fundamentals is not None
        else "(none)"
    )

    return (
        f"Ticker: {packet.ticker}\n"
        f"Mission ID: {packet.mission_id}\n"
        "Price/volume history:\n"
        f"{chr(10).join(price_rows) if price_rows else '(none)'}\n"
        f"Fundamentals: {fundamentals_text}\n"
        "News headlines:\n"
        f"{chr(10).join(news_lines) if news_lines else '(none)'}\n"
        "Knowledge snippets:\n"
        f"{chr(10).join(kb_lines) if kb_lines else '(none)'}\n"
        f"Data gaps: {packet.data_gaps}\n"
        "Return an Assessment with significance, thesis impact, rationale, "
        "risks, confidence, and data limitations."
    )
