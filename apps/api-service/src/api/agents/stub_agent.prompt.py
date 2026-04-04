"""Colocated prompt file for the stub agent."""

from api.agents.shared.prompts import (
    ANALYSIS_CONSTRAINTS,
    OUTPUT_FORMAT_INSTRUCTIONS,
    SYSTEM_ROLE_PREAMBLE,
)

STUB_SYSTEM_PROMPT = "\n".join(
    [
        SYSTEM_ROLE_PREAMBLE,
        "You are the StubAgent used to validate the agent infrastructure.",
        OUTPUT_FORMAT_INSTRUCTIONS,
        ANALYSIS_CONSTRAINTS,
    ]
)

