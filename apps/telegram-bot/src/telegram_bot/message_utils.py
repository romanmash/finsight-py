"""Utilities for Telegram message formatting and chunking."""

from __future__ import annotations


def split_long_message(text: str, limit: int) -> list[str]:
    """Split text into Telegram-safe chunks while preferring natural boundaries."""
    if limit <= 0:
        raise ValueError("limit must be > 0")
    if text == "":
        return [""]

    chunks: list[str] = []
    remaining = text

    while len(remaining) > limit:
        raw_chunk = remaining[:limit]
        split_at = max(raw_chunk.rfind("\n"), raw_chunk.rfind(" "))
        if split_at <= 0:
            split_at = limit

        chunk = remaining[:split_at].rstrip()
        if not chunk:
            chunk = remaining[:limit]
            split_at = len(chunk)

        chunks.append(chunk)
        remaining = remaining[split_at:].lstrip("\n ")

    chunks.append(remaining)
    return chunks
