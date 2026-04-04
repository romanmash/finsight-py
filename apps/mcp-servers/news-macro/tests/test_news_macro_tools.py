"""Tests for news-macro MCP tools."""

from __future__ import annotations

from datetime import UTC, datetime

import fakeredis.aioredis
import httpx
import pytest
import respx
from news_macro.cache import CacheHelper
from news_macro.server import startup_health_check
from news_macro.tools.macro import get_macro_signals
from news_macro.tools.news import get_news
from news_macro.tools.sentiment import get_sentiment


@pytest.fixture(autouse=True)
def fake_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = fakeredis.aioredis.FakeRedis(decode_responses=False)
    cache = CacheHelper(fake)
    monkeypatch.setattr("news_macro.tools.news._cache", cache)
    monkeypatch.setattr("news_macro.tools.sentiment._cache", cache)
    monkeypatch.setattr("news_macro.tools.macro._cache", cache)
    monkeypatch.setattr("news_macro.server._redis", fake)


@pytest.fixture(autouse=True)
def base_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("news_macro.tools.news._base_url", "https://news.test")
    monkeypatch.setattr("news_macro.tools.sentiment._base_url", "https://news.test")
    monkeypatch.setattr("news_macro.tools.macro._base_url", "https://macro.test")
    monkeypatch.setattr("news_macro.server._provider_probe_url", "https://news.test/health")


@pytest.mark.asyncio
async def test_get_news_success() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://news.test/news").respond(
            200,
            json={
                "items": [
                    {
                        "headline": "AAPL rises",
                        "source": "finnhub",
                        "published_at": datetime.now(UTC).isoformat(),
                    }
                ]
            },
        )
        result = await get_news("AAPL")
        assert result.data is not None
        assert result.data[0].headline == "AAPL rises"


@pytest.mark.asyncio
async def test_get_news_cache_hit() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://news.test/news").respond(
            200,
            json={
                "items": [
                    {
                        "headline": "x",
                        "source": "finnhub",
                        "published_at": datetime.now(UTC).isoformat(),
                    }
                ]
            },
        )
        first = await get_news("AAPL")
        second = await get_news("AAPL")
        assert first.cache_hit is False
        assert second.cache_hit is True


@pytest.mark.asyncio
async def test_get_news_source_unavailable() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://news.test/news").respond(503, json={"error": "down"})
        result = await get_news("AAPL")
        assert result.data is None
        assert result.error is not None


@pytest.mark.asyncio
async def test_get_sentiment_success() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://news.test/sentiment").respond(200, json={"score": 0.3})
        result = await get_sentiment("AAPL")
        assert result.data is not None
        assert result.data.label in {"bullish", "bearish", "neutral"}


@pytest.mark.asyncio
async def test_get_macro_signals_success() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://macro.test/macro-signals").respond(
            200, json={"market_sentiment": 0.5, "volatility": 0.4, "geopolitical_risk_index": 42.0}
        )
        result = await get_macro_signals()
        assert result.data is not None
        assert result.data.volatility_regime in {"low", "medium", "high"}


@pytest.mark.asyncio
async def test_get_macro_signals_unavailable() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://macro.test/macro-signals").mock(
            side_effect=httpx.ConnectTimeout("timeout")
        )
        result = await get_macro_signals()
        assert result.data is None
        assert result.error is not None


@pytest.mark.asyncio
async def test_startup_health_check_redis_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    class BadRedis:
        async def ping(self) -> bool:
            raise ConnectionError("down")

    monkeypatch.setattr("news_macro.server._redis", BadRedis())
    with pytest.raises(SystemExit):
        await startup_health_check()


@pytest.mark.asyncio
async def test_startup_health_check_all_ok() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://news.test/health").respond(200, json={"ok": True})
        await startup_health_check()



