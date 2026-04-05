from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
import respx
from dashboard.api_client import (
    BYPASS_TOKEN_SENTINEL,
    MISSING_TOKEN_SENTINEL,
    ApiClient,
    ApiError,
)
from dashboard.auth import get_token, refresh_if_needed
from dashboard.components.health_indicator import health_indicator
from dashboard.components.kb_entry_card import kb_entry_card
from dashboard.components.mission_card import mission_card
from dashboard.components.watchlist_form import watchlist_form
from dashboard.pages.health import (
    EXPECTED_SERVICES,
    is_stale,
    load_health_state,
    normalize_services,
    render_stale_badge,
)
from dashboard.pages.kb import normalize_query, search_kb_entries
from dashboard.pages.missions import (
    filter_missions,
    load_mission_detail,
    load_missions_list,
    mission_interval_disabled,
    render_mission_detail,
)
from dashboard.pages.overview import (
    load_overview_state,
    render_overview_cards,
    render_overview_error,
    summarize_overview,
)
from dashboard.pages.watchlist import (
    build_watchlist_payload,
    delete_watchlist_item,
    has_watchlist_write_access,
    render_watchlist_rows,
    save_watchlist_item,
    set_watchlist_active,
    watchlist_admin_controls_style,
)
from httpx import Request, Response


def test_overview_summary_counts() -> None:
    summary = summarize_overview(
        {"items": [{"id": 1}, {"id": 2}]},
        {"items": [{"id": "a"}]},
    )
    assert summary["mission_count"] == 2
    assert summary["alert_count"] == 1


def test_render_overview_cards_empty_state() -> None:
    cards = render_overview_cards([])
    assert len(cards) == 1
    assert cards[0].children == "No active missions"


def test_render_overview_error_panel() -> None:
    panel = render_overview_error(ApiError(status_code=503, message="down"))
    assert getattr(panel, "className", "") == "panel error-panel"


def test_mission_filter_and_detail_render() -> None:
    rows: list[dict[str, object]] = [
        {"id": "1", "status": "running", "mission_type": "unknown", "query": "a"},
        {"id": "2", "status": "completed", "mission_type": "unknown", "query": "b"},
    ]
    filtered = filter_missions(rows, "completed")
    assert len(filtered) == 1

    detail = render_mission_detail(
        {
            "mission": rows[1],
            "agent_runs": [{"agent_name": "analyst", "status": "completed", "cost_usd": "0.1"}],
        }
    )
    assert len(detail) >= 2



def test_mission_detail_renders_output_payload() -> None:
    detail = render_mission_detail(
        {
            "mission": {"id": "1", "status": "completed", "mission_type": "unknown"},
            "agent_runs": [
                {
                    "agent_name": "analyst",
                    "status": "completed",
                    "cost_usd": "0.1",
                    "output_data": {"summary": "Bullish"},
                }
            ],
        }
    )
    panel = detail[1]
    children = getattr(panel, "children", [])
    output_block = children[4]
    output_text = getattr(output_block, "children", "")
    assert isinstance(output_text, str)
    assert "Bullish" in output_text
def test_mission_interval_disabled_for_running_and_completed() -> None:
    assert mission_interval_disabled({"mission": {"status": "running"}}) is False
    assert mission_interval_disabled({"mission": {"status": "completed"}}) is True


def test_watchlist_payload_builder() -> None:
    payload = build_watchlist_payload(
        ticker="AAPL",
        name="Apple",
        sector="Technology",
        list_type="core",
        active_values=["active"],
        price_change_pct_threshold=3.0,
        volume_spike_multiplier=2.0,
    )
    assert payload["ticker"] == "AAPL"
    assert payload["name"] == "Apple"
    assert payload["sector"] == "Technology"
    assert payload["list_type"] == "core"
    assert payload["is_active"] is True


def test_watchlist_rows_render_header() -> None:
    rows = render_watchlist_rows([{"ticker": "AAPL", "is_active": True}])
    assert len(rows) >= 2
    assert getattr(rows[0], "className", "") == "watchlist-header"


def test_watchlist_admin_controls_style_for_roles(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("dashboard.auth.get_request_ip", lambda: "10.0.0.2")
    assert watchlist_admin_controls_style({"role": "viewer"}) == {"display": "none"}
    assert watchlist_admin_controls_style({"role": "admin"}) == {"display": "block"}
    assert watchlist_admin_controls_style(None) == {"display": "none"}

    monkeypatch.setattr("dashboard.auth.get_request_ip", lambda: "127.0.0.1")
    assert watchlist_admin_controls_style(None) == {"display": "block"}


def test_watchlist_write_access_policy() -> None:
    assert has_watchlist_write_access(role="admin", token=MISSING_TOKEN_SENTINEL) is True
    assert has_watchlist_write_access(role="viewer", token=BYPASS_TOKEN_SENTINEL) is True
    assert has_watchlist_write_access(role="", token=MISSING_TOKEN_SENTINEL) is False


def test_kb_query_and_health_staleness() -> None:
    assert normalize_query(" AAPL ") == "AAPL"
    recent = (datetime.now(UTC) - timedelta(seconds=5)).isoformat()
    old = (datetime.now(UTC) - timedelta(seconds=90)).isoformat()
    assert is_stale(recent, stale_threshold_seconds=30) is False
    assert is_stale(old, stale_threshold_seconds=30) is True


def test_health_normalize_services_contains_expected() -> None:
    normalized = normalize_services({"api": "healthy", "dashboard": "ok"})
    assert set(normalized.keys()) == set(EXPECTED_SERVICES)
    assert normalized["api"] == "healthy"
    assert normalized["worker-alert"] == "unknown"


def test_health_stale_badge() -> None:
    assert render_stale_badge(False) is None
    badge = render_stale_badge(True)
    assert badge is not None
    assert badge.children == "Stale"


def test_touch_target_component_classes() -> None:
    mission = mission_card({"id": "m1", "mission_type": "unknown", "status": "running"})
    assert "mission-card" in str(getattr(mission, "className", ""))

    form = watchlist_form()
    assert "card" in str(getattr(form, "className", ""))
    form_children = getattr(form, "children", [])
    assert any(getattr(child, "id", "") == "watchlist-name" for child in form_children)
    assert any(getattr(child, "id", "") == "watchlist-sector" for child in form_children)
    assert any(getattr(child, "id", "") == "watchlist-list-type" for child in form_children)

    health = health_indicator("api", "ok")
    assert "status-ok" in str(getattr(health, "className", ""))
    stale_health = health_indicator("api", "ok", stale=True)
    assert "status-stale" in str(getattr(stale_health, "className", ""))


def test_kb_conflict_class_rendered() -> None:
    card = kb_entry_card(
        {
            "ticker": "AAPL",
            "content_summary": "summary",
            "confidence": 0.7,
            "conflict_markers": ["conflict"],
            "tags": ["tech", "mega-cap"],
        }
    )
    assert "has-conflict" in str(getattr(card, "className", ""))
    children = getattr(card, "children", [])
    assert any(getattr(child, "className", "") == "kb-summary-expand" for child in children)
    assert any(getattr(child, "className", "") == "kb-tags" for child in children)


def test_auth_get_token_with_localhost_bypass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("dashboard.auth.get_request_ip", lambda: "127.0.0.1")
    assert get_token({"access_token": "abc"}, True) == BYPASS_TOKEN_SENTINEL

    monkeypatch.setattr("dashboard.auth.get_request_ip", lambda: "10.0.0.2")
    assert get_token({"access_token": "abc"}, False) == "abc"
    assert get_token(None, False) == MISSING_TOKEN_SENTINEL


@pytest.mark.asyncio()
async def test_api_client_header_modes(api_base_url: str) -> None:
    client = ApiClient(
        api_base_url=api_base_url,
        auth_bypass_localhost=True,
        bypass_token="bypass-secret",
    )

    with respx.mock(assert_all_called=True) as router:
        def _assert_bypass(request: Request) -> Response:
            assert request.headers.get("X-Dashboard-Bypass") == "1"
            assert request.headers.get("X-Dashboard-Bypass-Token") == "bypass-secret"
            assert request.headers.get("Authorization") is None
            return Response(200, json={"items": []})

        router.get(f"{api_base_url}/watchlist").mock(side_effect=_assert_bypass)
        bypass_payload = await client.get_watchlist(access_token=BYPASS_TOKEN_SENTINEL)
    assert isinstance(bypass_payload, dict)

    with respx.mock(assert_all_called=True) as router:
        def _assert_missing(request: Request) -> Response:
            assert request.headers.get("X-Dashboard-Bypass") is None
            assert request.headers.get("Authorization") is None
            return Response(200, json={"items": []})

        router.get(f"{api_base_url}/watchlist").mock(side_effect=_assert_missing)
        missing_payload = await client.get_watchlist(access_token=MISSING_TOKEN_SENTINEL)
    assert isinstance(missing_payload, dict)

    with respx.mock(assert_all_called=True) as router:
        def _assert_jwt(request: Request) -> Response:
            assert request.headers.get("Authorization") == "Bearer jwt-token"
            assert request.headers.get("X-Dashboard-Bypass") is None
            return Response(200, json={"items": []})

        router.get(f"{api_base_url}/watchlist").mock(side_effect=_assert_jwt)
        jwt_payload = await client.get_watchlist(access_token="jwt-token")
    assert isinstance(jwt_payload, dict)


@pytest.mark.asyncio()
async def test_auth_refresh_if_needed() -> None:
    class _StubClient(ApiClient):
        async def refresh_access_token(
            self, *, access_token: str | None
        ) -> dict[str, object] | ApiError:
            _ = access_token
            return {"access_token": "new-token", "expires_in": 120}

    now = datetime.now(UTC).timestamp()
    store = {"access_token": "old-token", "expires_at": now + 10}
    refreshed = await refresh_if_needed(store, _StubClient(api_base_url="http://api.test"))
    assert isinstance(refreshed, dict)
    assert refreshed.get("access_token") == "new-token"


@pytest.mark.asyncio()
async def test_overview_loader_success(api_base_url: str) -> None:
    client = ApiClient(api_base_url=api_base_url)
    with respx.mock(assert_all_called=True) as router:
        router.get(f"{api_base_url}/dashboard/overview").mock(
            return_value=Response(
                200,
                json={
                    "counts": {
                        "watchlist_active": 3,
                        "watchlist_total": 4,
                        "unacknowledged_alerts": 2,
                    },
                    "active_missions": [
                        {"id": "m1", "status": "running", "mission_type": "unknown"}
                    ],
                    "unacknowledged_alerts": [
                        {"id": "a1", "severity": "high", "trigger_condition": "x"},
                        {"id": "a2", "severity": "low", "trigger_condition": "y"},
                    ],
                    "recent_agent_runs": [{"agent_name": "analyst", "status": "completed"}],
                },
            )
        )
        (
            mission_items,
            alert_items,
            agent_runs,
            watchlist_summary,
            alert_count,
            error,
        ) = await load_overview_state(
            client,
            access_token="token",
        )

    assert error is None
    assert len(mission_items) == 1
    assert len(alert_items) == 2
    assert len(agent_runs) == 1
    assert "Watchlist" in watchlist_summary
    assert alert_count == 2


@pytest.mark.asyncio()
async def test_overview_loader_error(api_base_url: str) -> None:
    client = ApiClient(api_base_url=api_base_url)
    with respx.mock(assert_all_called=True) as router:
        router.get(f"{api_base_url}/dashboard/overview").mock(
            return_value=Response(503, text="down")
        )
        (
            mission_items,
            alert_items,
            agent_runs,
            watchlist_summary,
            alert_count,
            error,
        ) = await load_overview_state(
            client,
            access_token="token",
        )

    assert error is not None
    assert mission_items == []
    assert alert_items == []
    assert agent_runs == []
    assert watchlist_summary == ""
    assert alert_count == 0


@pytest.mark.asyncio()
async def test_missions_loader_and_detail(api_base_url: str) -> None:
    client = ApiClient(api_base_url=api_base_url)
    with respx.mock(assert_all_called=True) as router:
        router.get(f"{api_base_url}/missions").mock(
            return_value=Response(200, json={"items": [{"id": "m1", "status": "completed"}]})
        )
        router.get(f"{api_base_url}/missions/m1").mock(
            return_value=Response(
                200,
                json={"mission": {"id": "m1", "status": "completed"}, "agent_runs": []},
            )
        )
        items, list_error = await load_missions_list(
            client,
            status_filter="completed",
            limit=20,
            page=0,
            access_token="token",
        )
        detail, detail_error = await load_mission_detail(
            client,
            mission_id="m1",
            access_token="token",
        )

    assert list_error is None
    assert detail_error is None
    assert len(items) == 1
    assert detail is not None


@pytest.mark.asyncio()
async def test_watchlist_save_delete_toggle(api_base_url: str) -> None:
    client = ApiClient(api_base_url=api_base_url)

    with respx.mock(assert_all_called=True) as router:
        router.post(f"{api_base_url}/watchlist").mock(
            return_value=Response(201, json={"id": "w1", "ticker": "AAPL"})
        )
        router.patch(f"{api_base_url}/watchlist/w1").mock(
            return_value=Response(200, json={"id": "w1", "is_active": False})
        )
        router.delete(f"{api_base_url}/watchlist/w1").mock(return_value=Response(204))

        save_error = await save_watchlist_item(
            client,
            payload={"ticker": "AAPL", "is_active": True},
            access_token="token",
        )
        toggle_error = await set_watchlist_active(
            client,
            item_id="w1",
            active=False,
            access_token="token",
        )
        delete_error = await delete_watchlist_item(
            client,
            item_id="w1",
            access_token="token",
        )

    assert save_error is None
    assert toggle_error is None
    assert delete_error is None


@pytest.mark.asyncio()
async def test_kb_search_and_error(api_base_url: str) -> None:
    client = ApiClient(api_base_url=api_base_url)

    with respx.mock(assert_all_called=True) as router:
        router.get(f"{api_base_url}/knowledge").mock(
            return_value=Response(
                200,
                json={"items": [{"id": "k1", "ticker": "AAPL", "conflict_markers": ["x"]}]},
            )
        )
        items, error = await search_kb_entries(
            client,
            query="AAPL",
            page=0,
            page_size=10,
            access_token="token",
        )
    assert error is None
    assert len(items) == 1

    with respx.mock(assert_all_called=True) as router:
        router.get(f"{api_base_url}/knowledge").mock(return_value=Response(503, text="down"))
        _, error = await search_kb_entries(
            client,
            query="AAPL",
            page=0,
            page_size=10,
            access_token="token",
        )
    assert error is not None


@pytest.mark.asyncio()
async def test_health_loader(api_base_url: str) -> None:
    client = ApiClient(api_base_url=api_base_url)
    now_iso = datetime.now(UTC).isoformat()
    with respx.mock(assert_all_called=True) as router:
        router.get(f"{api_base_url}/dashboard/health").mock(
            return_value=Response(
                200,
                json={
                    "services": {"api": "healthy", "dashboard": "ok"},
                    "last_updated": now_iso,
                },
            )
        )
        services, stale, error = await load_health_state(
            client,
            access_token="token",
            stale_threshold_seconds=30,
        )

    assert error is None
    assert stale is False
    assert services["api"] == "healthy"
    assert "worker-mission" in services

