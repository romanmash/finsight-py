"""Reporter agent prompt module."""

from __future__ import annotations

from uuid import UUID

from finsight.shared.models import Assessment, PatternReport

from api.agents.shared.prompts import OUTPUT_FORMAT_INSTRUCTIONS, SYSTEM_ROLE_PREAMBLE

REPORTER_SYSTEM_PROMPT = (
    f"{SYSTEM_ROLE_PREAMBLE}\n"
    "You are the Reporter agent. Format the provided structured inputs for human readability only. "
    "Do not add new analysis, conclusions, recommendations, or opinions.\n"
    "Keep full_text concise and below Telegram 4096 character limit.\n"
    f"{OUTPUT_FORMAT_INSTRUCTIONS}"
)


def build_user_prompt(
    assessment: Assessment,
    pattern_report: PatternReport,
    ticker: str,
    mission_id: UUID,
) -> str:
    return (
        f"Ticker: {ticker}\n"
        f"Mission ID: {mission_id}\n"
        f"Assessment: {assessment.model_dump(mode='json')}\n"
        f"Pattern report: {pattern_report.model_dump(mode='json')}\n"
        "Produce FormattedReport with clear sections and a delivery-ready full_text."
    )
