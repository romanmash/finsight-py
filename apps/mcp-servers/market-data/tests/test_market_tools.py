"""Tests for market-data MCP tools."""

from __future__ import annotations

from datetime import UTC, datetime

import fakeredis.aioredis
import httpx
import pytest
import respx
from market_data.cache import CacheHelper
from market_data.server import startup_health_check
from market_data.tools.etf import get_etf_holdings
from market_data.tools.fundamentals import get_fundamentals
from market_data.tools.history import get_ohlcv
from market_data.tools.options import get_options_chain
from market_data.tools.price import get_price


@pytest.fixture(autouse=True)
def fake_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = fakeredis.aioredis.FakeRedis(decode_responses=False)
    cache = CacheHelper(fake)
    monkeypatch.setattr("market_data.tools.price._cache", cache)
    monkeypatch.setattr("market_data.tools.history._cache", cache)
    monkeypatch.setattr("market_data.tools.fundamentals._cache", cache)
    monkeypatch.setattr("market_data.tools.etf._cache", cache)
    monkeypatch.setattr("market_data.tools.options._cache", cache)
    monkeypatch.setattr("market_data.server._redis", fake)


@pytest.fixture(autouse=True)
def base_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("market_data.tools.price._base_url", "https://openbb.test")
    monkeypatch.setattr("market_data.tools.history._base_url", "https://openbb.test")
    monkeypatch.setattr("market_data.tools.fundamentals._base_url", "https://openbb.test")
    monkeypatch.setattr("market_data.tools.etf._base_url", "https://openbb.test")
    monkeypatch.setattr("market_data.tools.options._base_url", "https://openbb.test")
    monkeypatch.setattr(
        "market_data.server._provider_probe_url", "https://openbb.test/provider-health"
    )


@pytest.mark.asyncio
async def test_get_price_success() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://openbb.test/market/price").respond(
            200,
            json={
                "symbol": "AAPL",
                "price": "187.52",
                "change_pct": 1.2,
                "volume": 1000,
                "timestamp": datetime.now(UTC).isoformat(),
            },
        )
        response = await get_price("AAPL")
        assert response.data is not None
        assert response.data.symbol == "AAPL"
        assert response.error is None


@pytest.mark.asyncio
async def test_get_price_cache_hit() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        route = router.get("https://openbb.test/market/price").respond(
            200,
            json={
                "symbol": "AAPL",
                "price": "100",
                "change_pct": 0.0,
                "volume": 10,
                "timestamp": datetime.now(UTC).isoformat(),
            },
        )
        first = await get_price("AAPL")
        second = await get_price("AAPL")
        assert first.cache_hit is False
        assert second.cache_hit is True
        assert route.called


@pytest.mark.asyncio
async def test_get_price_invalid_symbol() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://openbb.test/market/price").respond(404, json={"error": "not found"})
        response = await get_price("INVALID")
        assert response.data is None
        assert response.error is not None


@pytest.mark.asyncio
async def test_get_price_timeout() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://openbb.test/market/price").mock(
            side_effect=httpx.ConnectTimeout("timeout")
        )
        response = await get_price("AAPL")
        assert response.data is None
        assert response.error is not None


@pytest.mark.asyncio
async def test_get_ohlcv_success() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://openbb.test/market/ohlcv").respond(
            200,
            json={
                "bars": [
                    {
                        "date": "2026-01-02",
                        "open": 1,
                        "high": 2,
                        "low": 0.5,
                        "close": 1.5,
                        "volume": 100,
                    }
                ]
            },
        )
        response = await get_ohlcv("AAPL")
        assert response.data is not None
        assert response.data.bars


@pytest.mark.asyncio
async def test_get_fundamentals_success() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://openbb.test/market/fundamentals").respond(
            200,
            json={
                "market_cap": "1000",
                "pe_ratio": 20.1,
                "eps": 5.2,
                "revenue": "1000000",
                "sector": "Tech",
            },
        )
        response = await get_fundamentals("AAPL")
        assert response.data is not None
        assert response.data.sector == "Tech"


@pytest.mark.asyncio
async def test_get_etf_holdings_success() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://openbb.test/market/etf-holdings").respond(
            200,
            json={
                "holdings": [{"ticker": "AAPL", "weight": 0.1, "name": "Apple"}],
                "as_of_date": "2026-01-02",
            },
        )
        response = await get_etf_holdings("QQQ")
        assert response.data is not None
        assert response.data.holdings


@pytest.mark.asyncio
async def test_get_options_chain_success() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://openbb.test/market/options").respond(
            200,
            json={
                "contracts": [
                    {
                        "strike": "100",
                        "expiry": "2026-02-20",
                        "call_put": "call",
                        "bid": "1.0",
                        "ask": "1.2",
                    }
                ]
            },
        )
        response = await get_options_chain("AAPL")
        assert response.data is not None
        assert response.data.contracts


@pytest.mark.asyncio
async def test_startup_health_check_redis_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    class BadRedis:
        async def ping(self) -> bool:
            raise ConnectionError("down")

    monkeypatch.setattr("market_data.server._redis", BadRedis())
    with pytest.raises(SystemExit):
        await startup_health_check()


@pytest.mark.asyncio
async def test_startup_health_check_all_ok() -> None:
    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://openbb.test/provider-health").respond(200, json={"ok": True})
        await startup_health_check()



