"""Database debugging tools (read-only)."""

from __future__ import annotations

import re
import time
from collections.abc import Mapping
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Protocol, cast
from uuid import UUID

from debug_mcp.models import DbColumn, DbQueryResult, DbTableInfoResult, ToolResponse

ROW_CAP = 500
_SELECT_ONLY = re.compile(r"^\s*select\b", re.IGNORECASE)
_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_db_pool: object | None = None


class DbPoolProtocol(Protocol):
    async def fetch(self, query: str, *args: object) -> list[Mapping[str, Any]]: ...

    async def fetchval(self, query: str, *args: object) -> object: ...


def set_db_pool(db_pool: object) -> None:
    """Configure the asyncpg pool."""
    global _db_pool
    _db_pool = db_pool


def _now_ms() -> float:
    return time.perf_counter() * 1000


def _elapsed_ms(start_ms: float) -> int:
    return int(_now_ms() - start_ms)


def _assert_select_only(sql: str) -> None:
    stripped = re.sub(r"(/\*.*?\*/|--[^\n]*)", "", sql, flags=re.DOTALL).strip()
    if not _SELECT_ONLY.match(stripped):
        raise ValueError("Only SELECT statements are permitted")
    statements = [segment.strip() for segment in stripped.split(";") if segment.strip()]
    if len(statements) != 1:
        raise ValueError("Only a single SELECT statement is permitted")


def _is_identifier(value: str) -> bool:
    return bool(_IDENTIFIER.match(value))


def _coerce_value(value: object) -> object | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def _to_int(value: object | None) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        return int(value)
    return None


def _extract_row_columns_and_values(row: object) -> tuple[list[str], list[object | None]]:
    if isinstance(row, Mapping):
        typed_row = cast(Mapping[str, object], row)
        columns = [str(key) for key in typed_row]
        return columns, [_coerce_value(typed_row[key]) for key in typed_row]

    keys_callable = getattr(row, "keys", None)
    if callable(keys_callable):
        keys = list(keys_callable())
        typed_row = cast(Mapping[str, object], row)
        return [str(key) for key in keys], [_coerce_value(typed_row[str(key)]) for key in keys]

    raise TypeError("Unsupported row type")


async def db_query(sql: str, params: list[object] | None = None) -> ToolResponse[DbQueryResult]:
    """Execute a read-only query and return capped rows."""
    started = _now_ms()
    params = params or []

    try:
        _assert_select_only(sql)
    except ValueError as exc:
        return ToolResponse(data=None, error=str(exc), latency_ms=_elapsed_ms(started))

    if _db_pool is None:
        return ToolResponse(
            data=None,
            error="Database pool is not configured",
            latency_ms=_elapsed_ms(started),
        )
    db_pool = cast(DbPoolProtocol, _db_pool)

    try:
        rows = await db_pool.fetch(sql, *params)
    except Exception as exc:
        return ToolResponse(
            data=None,
            error=f"DB query failed: {exc}",
            latency_ms=_elapsed_ms(started),
        )

    if not rows:
        return ToolResponse(
            data=DbQueryResult(columns=[], rows=[], row_count=0, capped=False),
            latency_ms=_elapsed_ms(started),
        )

    columns, _ = _extract_row_columns_and_values(rows[0])
    capped = len(rows) > ROW_CAP
    selected_rows = rows[:ROW_CAP]
    output_rows = [_extract_row_columns_and_values(row)[1] for row in selected_rows]

    return ToolResponse(
        data=DbQueryResult(
            columns=columns,
            rows=output_rows,
            row_count=len(output_rows),
            capped=capped,
        ),
        latency_ms=_elapsed_ms(started),
    )


async def db_table_info(table: str) -> ToolResponse[DbTableInfoResult]:
    """Return schema details and estimated row count for a table."""
    started = _now_ms()

    if not _is_identifier(table):
        return ToolResponse(
            data=None,
            error="Invalid table identifier",
            latency_ms=_elapsed_ms(started),
        )

    if _db_pool is None:
        return ToolResponse(
            data=None,
            error="Database pool is not configured",
            latency_ms=_elapsed_ms(started),
        )
    db_pool = cast(DbPoolProtocol, _db_pool)

    table_exists = await db_pool.fetchval(
        """
        SELECT EXISTS(
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
        )
        """,
        table,
    )
    if not table_exists:
        return ToolResponse(
            data=None,
            error=f"Table '{table}' not found",
            latency_ms=_elapsed_ms(started),
        )

    column_rows = await db_pool.fetch(
        """
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
        """,
        table,
    )
    estimate = await db_pool.fetchval(
        """
        SELECT reltuples::bigint
        FROM pg_class
        WHERE oid = to_regclass($1)
        """,
        f"public.{table}",
    )

    typed_column_rows = cast(list[Mapping[str, object]], column_rows)
    columns = [
        DbColumn(
            name=str(row["column_name"]),
            type=str(row["data_type"]),
            nullable=str(row["is_nullable"]).upper() == "YES",
            default=str(row["column_default"]) if row["column_default"] is not None else None,
        )
        for row in typed_column_rows
    ]

    estimate_value = _to_int(estimate)
    return ToolResponse(
        data=DbTableInfoResult(
            table=table,
            columns=columns,
            row_estimate=estimate_value,
        ),
        latency_ms=_elapsed_ms(started),
    )


async def db_recent_rows(
    table: str,
    limit: int = 20,
    order_by: str = "id",
) -> ToolResponse[DbQueryResult]:
    """Return latest rows from a validated table and order column."""
    started = _now_ms()

    if _db_pool is None:
        return ToolResponse(
            data=None,
            error="Database pool is not configured",
            latency_ms=_elapsed_ms(started),
        )
    db_pool = cast(DbPoolProtocol, _db_pool)

    if not _is_identifier(table) or not _is_identifier(order_by):
        return ToolResponse(
            data=None,
            error="Invalid table or order_by identifier",
            latency_ms=_elapsed_ms(started),
        )

    table_exists = await db_pool.fetchval(
        """
        SELECT EXISTS(
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
        )
        """,
        table,
    )
    if not table_exists:
        return ToolResponse(
            data=None,
            error=f"Table '{table}' not found",
            latency_ms=_elapsed_ms(started),
        )

    col_exists = await db_pool.fetchval(
        """
        SELECT EXISTS(
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
        )
        """,
        table,
        order_by,
    )
    if not col_exists:
        return ToolResponse(
            data=None,
            error=f"Column '{order_by}' not found in table '{table}'",
            latency_ms=_elapsed_ms(started),
        )

    bounded = max(1, min(limit, ROW_CAP))
    sql = f'SELECT * FROM "{table}" ORDER BY "{order_by}" DESC LIMIT $1'
    rows = await db_pool.fetch(sql, bounded)

    if not rows:
        return ToolResponse(
            data=DbQueryResult(columns=[], rows=[], row_count=0, capped=False),
            latency_ms=_elapsed_ms(started),
        )

    columns, _ = _extract_row_columns_and_values(rows[0])
    output_rows = [_extract_row_columns_and_values(row)[1] for row in rows]

    return ToolResponse(
        data=DbQueryResult(
            columns=columns,
            rows=output_rows,
            row_count=len(output_rows),
            capped=limit > ROW_CAP,
        ),
        latency_ms=_elapsed_ms(started),
    )
