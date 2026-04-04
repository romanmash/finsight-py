"""Watchdog collector agent implementation."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import structlog
from pydantic import BaseModel

from api.db.models.watchlist_item import WatchlistItemORM
from api.db.repositories.agent_run import AgentRunRepository
from api.db.repositories.alert import AlertRepository
from api.db.repositories.mission import MissionRepository
from api.db.repositories.watchlist_item import WatchlistItemRepository
from api.mcp.client import MCPClient, MCPToolError
from config.schemas.watchdog import WatchdogConfig

logger = structlog.get_logger(__name__)


class WatchdogResult(BaseModel):
    alerts_created: int
    missions_opened: int
    items_evaluated: int
    dedup_skipped: int


class WatchdogAgent:
    """Evaluate watchlist thresholds and open missions on breach."""

    def __init__(
        self,
        watchdog_config: WatchdogConfig,
        watchlist_repo: WatchlistItemRepository,
        alert_repo: AlertRepository,
        mission_repo: MissionRepository,
        mcp_client: MCPClient,
        agent_run_repo: AgentRunRepository,
    ) -> None:
        self.watchdog_config = watchdog_config
        self.watchlist_repo = watchlist_repo
        self.alert_repo = alert_repo
        self.mission_repo = mission_repo
        self.mcp_client = mcp_client
        self.agent_run_repo = agent_run_repo

    async def run(self, mission_id: UUID | None = None) -> WatchdogResult:
        started_at = datetime.now(UTC)
        run_mission_id = await self._resolve_run_mission_id(mission_id)
        items = await self.watchlist_repo.list_active()
        result = WatchdogResult(
            alerts_created=0,
            missions_opened=0,
            items_evaluated=0,
            dedup_skipped=0,
        )

        for item in items:
            result.items_evaluated += 1
            price_data = await self._call_tool("market.get_price", {"symbol": item.ticker})
            news_data = await self._call_tool(
                "news.get_news",
                {"query": item.ticker, "limit": self.watchdog_config.news_fetch_limit},
            )

            if price_data is not None:
                created, deduped = await self._handle_price_volume(item, price_data)
                result.alerts_created += created
                result.missions_opened += created
                result.dedup_skipped += deduped

            news_items = self._extract_news_items(news_data)
            news_breach, news_description, observed_count, news_threshold = (
                self._evaluate_news_volume(
                    news_items,
                    self.watchdog_config.news_spike_rate_per_hour,
                    item.ticker,
                )
            )
            if news_breach:
                deduped = await self._create_alert_and_mission(
                    item=item,
                    condition_type="news_spike",
                    description=news_description,
                    observed_value=float(observed_count),
                    threshold_value=float(news_threshold),
                    severity=self._assess_severity(
                        float(observed_count) / float(news_threshold)
                        if news_threshold > 0
                        else 1.0
                    ),
                )
                if deduped:
                    result.dedup_skipped += 1
                else:
                    result.alerts_created += 1
                    result.missions_opened += 1

        await self.agent_run_repo.create(
            {
                "mission_id": run_mission_id,
                "agent_name": "watchdog",
                "status": "completed",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": Decimal("0.00"),
                "provider": None,
                "model": None,
                "duration_ms": self._duration_ms(started_at, datetime.now(UTC)),
                "input_snapshot": {
                    "mission_id": str(run_mission_id),
                    "items": len(items),
                },
                "output_snapshot": result.model_dump(mode="json"),
                "error_message": None,
                "started_at": started_at,
                "completed_at": datetime.now(UTC),
            }
        )

        return result

    async def _handle_price_volume(
        self, item: WatchlistItemORM, price_data: dict[str, Any]
    ) -> tuple[int, int]:
        alerts_created = 0
        dedup_skipped = 0

        current_price = self._as_float(price_data.get("current_price"))
        prev_close = self._as_float(price_data.get("prev_close"))
        current_volume = self._as_float(price_data.get("current_volume"))
        avg_volume = self._as_float(price_data.get("avg_volume"))

        price_threshold = self._effective_threshold(
            item,
            self.watchdog_config.default_thresholds.price_change_pct,
            "price_change_pct_threshold",
        )

        if current_price is not None and prev_close is not None and prev_close != 0.0:
            change_pct = abs((current_price - prev_close) / prev_close) * 100.0
            if change_pct >= price_threshold:
                description = (
                    f"{item.ticker} price moved {change_pct:.1f}% exceeding the "
                    f"{price_threshold:.1f}% threshold"
                )
                deduped = await self._create_alert_and_mission(
                    item=item,
                    condition_type="price_move",
                    description=description,
                    observed_value=change_pct,
                    threshold_value=price_threshold,
                    severity=self._assess_severity(change_pct / price_threshold),
                )
                if deduped:
                    dedup_skipped += 1
                else:
                    alerts_created += 1

        volume_multiplier = self._effective_threshold(
            item,
            self.watchdog_config.default_thresholds.volume_spike_multiplier,
            "volume_spike_multiplier",
        )
        if current_volume is not None and avg_volume is not None and avg_volume != 0.0:
            threshold_volume = avg_volume * volume_multiplier
            if current_volume >= threshold_volume:
                ratio = current_volume / threshold_volume
                description = (
                    f"{item.ticker} volume spike: {current_volume:.0f} "
                    f"vs threshold {threshold_volume:.0f}"
                )
                deduped = await self._create_alert_and_mission(
                    item=item,
                    condition_type="volume_spike",
                    description=description,
                    observed_value=current_volume,
                    threshold_value=threshold_volume,
                    severity=self._assess_severity(ratio),
                )
                if deduped:
                    dedup_skipped += 1
                else:
                    alerts_created += 1

        return alerts_created, dedup_skipped

    async def _create_alert_and_mission(
        self,
        item: WatchlistItemORM,
        condition_type: str,
        description: str,
        observed_value: float,
        threshold_value: float,
        severity: str,
    ) -> bool:
        recent = await self.alert_repo.get_recent(
            ticker=item.ticker,
            condition_type=condition_type,
            window_hours=self.watchdog_config.dedup_window_hours,
        )
        if recent:
            return True

        mission = await self.mission_repo.create(
            {
                "mission_type": "alert",
                "source": "alert",
                "status": "pending",
                "query": description,
                "ticker": item.ticker,
            }
        )
        await self.alert_repo.create(
            {
                "watchlist_item_id": item.id,
                "mission_id": mission.id,
                "condition_type": condition_type,
                "severity": severity,
                "trigger_condition": description,
                "observed_value": observed_value,
                "threshold_value": threshold_value,
            }
        )
        return False

    async def _resolve_run_mission_id(self, mission_id: UUID | None) -> UUID:
        if mission_id is not None:
            return mission_id
        mission = await self.mission_repo.create(
            {
                "mission_type": "watchdog_cycle",
                "source": "watchdog",
                "status": "completed",
                "query": "watchdog scheduled sweep",
                "ticker": None,
            }
        )
        return mission.id

    async def _call_tool(self, tool_name: str, params: dict[str, Any]) -> dict[str, Any] | None:
        try:
            return await self.mcp_client.call_tool(tool_name, params)
        except MCPToolError as exc:
            logger.error("mcp_tool_error", tool=tool_name, detail=str(exc))
            return None

    @staticmethod
    def _effective_threshold(item: WatchlistItemORM, yaml_default: float, item_field: str) -> float:
        value = getattr(item, item_field, None)
        if isinstance(value, (int, float)) and value > 0:
            return float(value)
        if isinstance(value, (int, float)) and value <= 0:
            logger.warning(
                "invalid_watchlist_threshold_fallback_to_default",
                ticker=item.ticker,
                field=item_field,
                value=value,
                default=yaml_default,
            )
        return float(yaml_default)

    @staticmethod
    def _as_float(value: Any) -> float | None:
        if isinstance(value, (int, float)):
            return float(value)
        return None

    @staticmethod
    def _assess_severity(ratio: float) -> str:
        if ratio > 5.0:
            return "critical"
        if ratio >= 2.0:
            return "warning"
        return "info"

    def _evaluate_news_volume(
        self, news_items: list[dict[str, Any]], threshold_per_hour: int, ticker: str
    ) -> tuple[bool, str, int, int]:
        count = 0
        cutoff = datetime.now(UTC) - timedelta(hours=1)
        for item in news_items:
            published_at = self._parse_datetime(item.get("published_at"))
            if published_at is not None and published_at >= cutoff:
                count += 1

        if count >= threshold_per_hour:
            detail = (
                f"{ticker} news volume spike: {count} articles in last hour "
                f"(threshold: {threshold_per_hour})"
            )
            return True, detail, count, threshold_per_hour
        return False, "", count, threshold_per_hour

    @staticmethod
    def _extract_news_items(news_data: dict[str, Any] | None) -> list[dict[str, Any]]:
        if news_data is None:
            return []
        raw = news_data.get("items", news_data.get("articles", news_data.get("news", [])))
        if isinstance(raw, list):
            return [item for item in raw if isinstance(item, dict)]
        return []

    @staticmethod
    def _parse_datetime(value: Any) -> datetime | None:
        if isinstance(value, datetime):
            return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)
            except ValueError:
                return None
        return None

    @staticmethod
    def _duration_ms(started_at: datetime, completed_at: datetime) -> int:
        return int((completed_at - started_at).total_seconds() * 1000)
