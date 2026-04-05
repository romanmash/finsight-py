"""Watchlist management routes for dashboard."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Protocol
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.repositories.watchlist_item import WatchlistItemRepository
from api.lib.db import get_session
from api.routes.dashboard_auth import DashboardAdminOperator, DashboardViewerOrAdminOperator

router = APIRouter()
AllowedListType = Literal["core", "satellite", "experimental"]


class WatchlistPayload(BaseModel):
    ticker: str = Field(min_length=1, max_length=16)
    name: str | None = Field(default=None, max_length=128)
    sector: str | None = Field(default=None, max_length=128)
    list_type: AllowedListType | None = None
    is_active: bool = True
    price_change_pct_threshold: float | None = None
    volume_spike_multiplier: float | None = None


class WatchlistPatchPayload(BaseModel):
    ticker: str | None = Field(default=None, min_length=1, max_length=16)
    name: str | None = Field(default=None, max_length=128)
    sector: str | None = Field(default=None, max_length=128)
    list_type: AllowedListType | None = None
    is_active: bool | None = None
    price_change_pct_threshold: float | None = None
    volume_spike_multiplier: float | None = None


class WatchlistResponse(BaseModel):
    id: UUID
    ticker: str
    name: str | None
    sector: str | None
    list_type: str | None
    is_active: bool
    price_change_pct_threshold: float | None
    volume_spike_multiplier: float | None
    created_at: datetime
    updated_at: datetime


class _WatchlistLike(Protocol):
    id: UUID
    ticker: str
    name: str | None
    sector: str | None
    list_type: str | None
    is_active: bool
    price_change_pct_threshold: float | None
    volume_spike_multiplier: float | None
    created_at: datetime
    updated_at: datetime


def _serialize(entity: _WatchlistLike) -> WatchlistResponse:
    return WatchlistResponse(
        id=entity.id,
        ticker=entity.ticker,
        name=entity.name,
        sector=entity.sector,
        list_type=entity.list_type,
        is_active=entity.is_active,
        price_change_pct_threshold=entity.price_change_pct_threshold,
        volume_spike_multiplier=entity.volume_spike_multiplier,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )


@router.get("")
async def list_watchlist(
    _: DashboardViewerOrAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, object]:
    repo = WatchlistItemRepository(session)
    items = await repo.list(include_inactive=True)
    return {"items": [_serialize(item).model_dump(mode="json") for item in items]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_watchlist_item(
    payload: WatchlistPayload,
    _: DashboardAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, object]:
    repo = WatchlistItemRepository(session)
    entity = await repo.create(payload.model_dump())
    await session.commit()
    return _serialize(entity).model_dump(mode="json")


@router.patch("/{item_id}")
async def update_watchlist_item(
    item_id: UUID,
    payload: WatchlistPatchPayload,
    _: DashboardAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, object]:
    repo = WatchlistItemRepository(session)
    update_data = payload.model_dump(exclude_unset=True)
    if len(update_data) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )
    entity = await repo.update(item_id, update_data)
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist item not found",
        )
    await session.commit()
    return _serialize(entity).model_dump(mode="json")


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist_item(
    item_id: UUID,
    _: DashboardAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    repo = WatchlistItemRepository(session)
    deleted = await repo.soft_delete(item_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist item not found",
        )
    await session.commit()
