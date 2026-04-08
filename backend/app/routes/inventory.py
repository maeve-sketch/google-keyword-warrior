from __future__ import annotations

from fastapi import APIRouter

from app.db.repository import get_repository
from app.services.inventory_service import (
    compute_gap_matrix,
    compute_mix_ratio,
    sync_published_content,
)

router = APIRouter()


@router.get("")
def get_inventory() -> dict:
    repo = get_repository()
    items = repo.list_content_inventory()
    return {"items": items, "total": len(items)}


@router.post("/sync")
def sync_inventory() -> dict:
    items = sync_published_content()
    return {"ok": True, "synced": len(items)}


@router.get("/gap-matrix")
def get_gap_matrix() -> dict:
    entries = compute_gap_matrix()
    return {"entries": entries, "total": len(entries)}


@router.get("/mix-ratio")
def get_mix_ratio() -> dict:
    return compute_mix_ratio()
