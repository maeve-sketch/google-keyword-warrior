from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.repository import get_repository
from app.services.google_ads_service import fetch_converting_search_terms
from app.services.keyword_planner_service import expand_keywords
from app.services.search_console_service import fetch_search_console_queries
from app.services.weighting_service import compute_weighted_scores


router = APIRouter()


class FetchKeywordsBody(BaseModel):
    dateRange: str = "30d"
    language: str = "ja"
    limit: int = 50
    minSearchVolume: int = 10
    searchConsoleMinImpressions: int = 100
    adsMinClicks: int = 10
    adsMinSpend: float = 0.0
    includeHighCompetition: bool = True
    plannerSeeds: list[str] = []


class StatusBody(BaseModel):
    status: str


@router.post("/fetch")
def fetch_keywords(body: FetchKeywordsBody) -> dict:
    repository = get_repository()
    warnings: list[str] = []
    ads_keywords: list[dict] = []
    planner_keywords: list[dict] = []
    try:
        ads_keywords = fetch_converting_search_terms(
            date_range=body.dateRange,
            limit=body.limit,
            language=body.language,
            min_clicks=body.adsMinClicks,
            min_spend=body.adsMinSpend,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Google Ads fetch failed: {exc}") from exc

    planner_seed_keywords = body.plannerSeeds or [row["keyword"] for row in ads_keywords[: min(len(ads_keywords), 10)]]
    if planner_seed_keywords:
        try:
            planner_keywords = expand_keywords(
                planner_seed_keywords,
                language=body.language,
                limit=body.limit,
                min_search_volume=body.minSearchVolume,
                include_high_competition=body.includeHighCompetition,
            )
        except Exception as exc:
            warnings.append(f"Keyword Planner fetch skipped: {exc}")
    else:
        warnings.append("Keyword Planner fetch skipped: Google Ads seed keyword가 없어 확장을 실행하지 않았습니다.")

    search_console_keywords: list[dict] = []
    try:
        search_console_keywords = fetch_search_console_queries(
            date_range=body.dateRange,
            language=body.language,
            limit=body.limit,
            min_impressions=body.searchConsoleMinImpressions,
        )
    except Exception as exc:
        warnings.append(f"Search Console fetch skipped: {exc}")

    all_keywords = ads_keywords + planner_keywords + search_console_keywords
    compute_weighted_scores(all_keywords)
    rows = repository.replace_keywords(all_keywords)
    return {
        "inserted": len(rows),
        "keywords": rows,
        "breakdown": {
            "google_ads": len([row for row in rows if row.get("source") == "google_ads"]),
            "keyword_planner": len([row for row in rows if row.get("source") == "keyword_planner"]),
            "search_console": len([row for row in rows if row.get("source") == "search_console"]),
        },
        "warnings": warnings,
    }


@router.get("")
def get_keywords(
    status: Optional[str] = None,
    competition: Optional[str] = None,
    minVolume: Optional[int] = None,
    maxVolume: Optional[int] = None,
    lang: str = "ja",
) -> dict:
    repository = get_repository()
    rows = repository.list_keywords()
    # Backfill weighted scores for keywords missing them
    needs_update = any(row.get("weighted_score") is None for row in rows)
    if needs_update:
        compute_weighted_scores(rows)
    filtered: List[dict] = []
    for row in rows:
        if row.get("language_code") != lang:
            continue
        if status and row.get("status") != status:
            continue
        if competition and row.get("competition_level") != competition:
            continue
        volume = row.get("search_volume") or 0
        if minVolume is not None and volume < minVolume:
            continue
        if maxVolume is not None and volume > maxVolume:
            continue
        filtered.append(row)
    return {"keywords": filtered, "total": len(filtered)}


@router.patch("/{keyword_id}/status")
def patch_keyword_status(keyword_id: str, body: StatusBody) -> dict:
    repository = get_repository()
    keyword = repository.update_keyword_status(keyword_id, body.status)
    if keyword is None:
        raise HTTPException(status_code=404, detail="Keyword not found")
    return {"ok": True, "keyword": keyword}


@router.delete("/{keyword_id}")
def delete_keyword(keyword_id: str) -> dict:
    repository = get_repository()
    removed = repository.delete_keyword(keyword_id)
    if removed is None:
        raise HTTPException(status_code=404, detail="Keyword not found")
    return {"ok": True, "removed": removed}
