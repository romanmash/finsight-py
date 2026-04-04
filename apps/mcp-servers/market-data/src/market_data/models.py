"""Pydantic models for market-data MCP server."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ToolResponse[T](BaseModel):
    """Standard response envelope for tool calls."""

    model_config = ConfigDict(frozen=True)

    data: T | None
    error: str | None = None
    cache_hit: bool = False
    latency_ms: int = 0


class PriceData(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    price: Decimal
    change_pct: float
    volume: int
    timestamp: datetime


class OHLCVBar(BaseModel):
    model_config = ConfigDict(frozen=True)

    date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int


class OHLCVData(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    bars: list[OHLCVBar]


class FundamentalsData(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    market_cap: Decimal | None
    pe_ratio: float | None
    eps: float | None
    revenue: Decimal | None
    sector: str | None


class ETFHolding(BaseModel):
    model_config = ConfigDict(frozen=True)

    ticker: str
    weight: float
    name: str | None


class ETFData(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    holdings: list[ETFHolding]
    as_of_date: date | None


class OptionsContract(BaseModel):
    model_config = ConfigDict(frozen=True)

    strike: Decimal
    expiry: date
    call_put: Literal["call", "put"]
    bid: Decimal
    ask: Decimal
    iv: float | None
    open_interest: int | None


class OptionsData(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    contracts: list[OptionsContract]
