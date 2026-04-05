"""Dashboard pages package."""

from dashboard.pages.health import layout as health_layout
from dashboard.pages.kb import layout as kb_layout
from dashboard.pages.missions import layout as missions_layout
from dashboard.pages.overview import layout as overview_layout
from dashboard.pages.watchlist import layout as watchlist_layout

__all__ = [
    "overview_layout",
    "missions_layout",
    "watchlist_layout",
    "kb_layout",
    "health_layout",
]
