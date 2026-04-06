"""Tests for database debug tools."""

from __future__ import annotations

import pytest
from debug_mcp.tools import db


class _FakeDbPool:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[object, ...]]] = []
        self.query_rows: list[dict[str, object]] = []
        self.columns: list[dict[str, object]] = []
        self.table_exists: bool = True
        self.column_exists: bool = True

    async def fetch(self, sql: str, *args: object) -> list[dict[str, object]]:
        self.calls.append((sql, args))
        if "information_schema.columns" in sql:
            return self.columns
        if "FROM agent_runs" in sql:
            return []
        return self.query_rows

    async def fetchval(self, sql: str, *args: object) -> object:
        self.calls.append((sql, args))
        if "information_schema.tables" in sql:
            return self.table_exists
        if "information_schema.columns" in sql:
            return self.column_exists
        if "reltuples" in sql:
            return 321
        return 0


@pytest.mark.asyncio
async def test_db_query_select_accepted() -> None:
    pool = _FakeDbPool()
    pool.query_rows = [{"id": 1, "status": "ok"}]
    db.set_db_pool(pool)

    result = await db.db_query("SELECT id, status FROM runs")

    assert result.data is not None
    assert result.data.columns == ["id", "status"]
    assert result.data.row_count == 1


@pytest.mark.asyncio
async def test_db_query_insert_rejected_before_db_call() -> None:
    pool = _FakeDbPool()
    db.set_db_pool(pool)

    result = await db.db_query("INSERT INTO x VALUES (1)")

    assert result.data is None
    assert result.error == "Only SELECT statements are permitted"
    assert pool.calls == []


@pytest.mark.asyncio
async def test_db_query_comment_then_select_allowed() -> None:
    pool = _FakeDbPool()
    pool.query_rows = [{"value": 42}]
    db.set_db_pool(pool)

    result = await db.db_query("-- comment\nSELECT value FROM t")

    assert result.data is not None
    assert result.data.row_count == 1


@pytest.mark.asyncio
async def test_db_query_single_statement_with_trailing_semicolon_allowed() -> None:
    pool = _FakeDbPool()
    pool.query_rows = [{"id": 7}]
    db.set_db_pool(pool)

    result = await db.db_query("SELECT id FROM t;")

    assert result.data is not None
    assert result.data.row_count == 1


@pytest.mark.asyncio
async def test_db_query_multiple_statements_rejected_before_db_call() -> None:
    pool = _FakeDbPool()
    db.set_db_pool(pool)

    result = await db.db_query("SELECT id FROM t; DELETE FROM t;")

    assert result.data is None
    assert result.error == "Only a single SELECT statement is permitted"
    assert pool.calls == []


@pytest.mark.asyncio
async def test_db_query_row_cap_enforced() -> None:
    pool = _FakeDbPool()
    pool.query_rows = [{"id": idx} for idx in range(700)]
    db.set_db_pool(pool)

    result = await db.db_query("SELECT id FROM t")

    assert result.data is not None
    assert result.data.capped is True
    assert result.data.row_count == 500


@pytest.mark.asyncio
async def test_db_table_info_returns_schema() -> None:
    pool = _FakeDbPool()
    pool.columns = [
        {"column_name": "id", "data_type": "uuid", "is_nullable": "NO", "column_default": None},
        {
            "column_name": "status",
            "data_type": "varchar",
            "is_nullable": "YES",
            "column_default": "'new'::character varying",
        },
    ]
    db.set_db_pool(pool)

    result = await db.db_table_info("missions")

    assert result.data is not None
    assert result.data.table == "missions"
    assert len(result.data.columns) == 2
