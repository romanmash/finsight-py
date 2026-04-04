"""Shared domain type aliases for FinSight."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

type AgentName = str
type MissionID = UUID
type Timestamp = datetime
type CostUSD = Decimal
