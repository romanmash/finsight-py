"""Researcher agent charter (no runtime LLM usage).

Role: collect only. Assemble factual tool outputs verbatim into ResearchPacket.
Never add analysis, recommendations, conclusions, or opinions.
Record missing sections explicitly in data_gaps.
"""

from api.agents.shared.prompts import SYSTEM_ROLE_PREAMBLE

RESEARCHER_SYSTEM_PROMPT = (
    f"{SYSTEM_ROLE_PREAMBLE}\n"
    "You are the Researcher collector. Return factual structured data only."
)
