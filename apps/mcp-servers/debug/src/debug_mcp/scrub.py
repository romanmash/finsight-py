"""Secret scrubbing for debug log output."""

from __future__ import annotations

import re

_PATTERN = re.compile(
    r'(?i)(("?)(?:\w+_)?(?:key|token|password|secret|api_key|private_key)\2'
    r'\s*[:=]\s*["\']?)([^\s"\'\\,\]}\n]+)',
)


def scrub(text: str) -> str:
    """Redact potential secret values from a log line."""
    return _PATTERN.sub(r"\1[REDACTED]", text)
