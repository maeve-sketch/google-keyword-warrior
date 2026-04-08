from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import get_settings
from app.db.repository import get_repository
from app.services.seed_expansion_service import run_seed_expansion


router = APIRouter()


class SchedulerBody(BaseModel):
    cron: str


class SeedConfigBody(BaseModel):
    country: str
    procedure_name: str
    region: str = ""
    seed_keywords: List[str] = []
    is_active: bool = True


class SeedConfigUpdateBody(BaseModel):
    country: Optional[str] = None
    procedure_name: Optional[str] = None
    region: Optional[str] = None
    seed_keywords: Optional[List[str]] = None
    is_active: Optional[bool] = None


CURRENT_CRON = get_settings().schedule_cron


@router.get("/status")
def scheduler_status() -> dict:
    return {"cron": CURRENT_CRON, "enabled": True}


@router.post("/update")
def scheduler_update(body: SchedulerBody) -> dict:
    global CURRENT_CRON
    CURRENT_CRON = body.cron
    return {"ok": True, "cron": CURRENT_CRON}


@router.post("/run-now")
def scheduler_run_now() -> dict:
    result = run_seed_expansion()
    return {"ok": True, **result}


# --- Seed Expansion Config CRUD ---

@router.get("/configs")
def list_seed_configs() -> dict:
    repo = get_repository()
    configs = repo.list_seed_configs()
    return {"configs": configs, "total": len(configs)}


@router.post("/configs")
def create_seed_config(body: SeedConfigBody) -> dict:
    repo = get_repository()
    config = repo.upsert_seed_config({
        "country": body.country,
        "procedure_name": body.procedure_name,
        "region": body.region,
        "seed_keywords": body.seed_keywords,
        "is_active": body.is_active,
    })
    return {"ok": True, "config": config}


@router.patch("/configs/{config_id}")
def update_seed_config(config_id: str, body: SeedConfigUpdateBody) -> dict:
    repo = get_repository()
    existing = repo.list_seed_configs()
    found = next((c for c in existing if c.get("id") == config_id), None)
    if found is None:
        raise HTTPException(status_code=404, detail="Config not found")

    patch = {k: v for k, v in body.dict().items() if v is not None}
    found.update(patch)
    repo.upsert_seed_config(found)
    return {"ok": True, "config": found}


@router.delete("/configs/{config_id}")
def delete_seed_config(config_id: str) -> dict:
    repo = get_repository()
    removed = repo.delete_seed_config(config_id)
    if removed is None:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"ok": True, "removed": removed}
