from __future__ import annotations

from telegram_bot.message_utils import split_long_message


def test_split_long_message_edge_cases() -> None:
    assert split_long_message("", 4096) == [""]
    assert split_long_message("a" * 4096, 4096) == ["a" * 4096]
    assert split_long_message("a" * 4097, 4096) == ["a" * 4096, "a"]


def test_split_long_message_prefers_newlines() -> None:
    text = "line1\nline2\n" + ("x" * 5000)
    chunks = split_long_message(text, 4096)
    assert len(chunks) >= 2
    assert all(len(chunk) <= 4096 for chunk in chunks)
