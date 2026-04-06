"""Tests for log secret scrubbing."""

from __future__ import annotations

from debug_mcp.scrub import scrub


def test_scrub_env_style_value_redacted() -> None:
    line = "OPENAI_API_KEY=sk-secret-value"
    assert scrub(line) == "OPENAI_API_KEY=[REDACTED]"


def test_scrub_json_style_value_redacted() -> None:
    line = '"token": "abc123"'
    assert scrub(line) == '"token": "[REDACTED]"'


def test_scrub_multiple_lines() -> None:
    text = "PASSWORD=one\nnormal\nPRIVATE_KEY=two"
    assert scrub(text) == "PASSWORD=[REDACTED]\nnormal\nPRIVATE_KEY=[REDACTED]"


def test_scrub_non_secret_text_unchanged() -> None:
    line = "service started successfully"
    assert scrub(line) == line


def test_scrub_empty_text() -> None:
    assert scrub("") == ""
