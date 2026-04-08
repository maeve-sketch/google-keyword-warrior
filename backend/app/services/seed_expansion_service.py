"""Seed keyword auto-expansion service.

Generates seed combos from admin configs (country x procedure x region),
queries GKP API, cross-references with existing GSC data, and marks
new opportunities.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List

from app.db.repository import get_repository
from app.services.keyword_planner_service import expand_keywords
from app.services.weighting_service import compute_weighted_scores

logger = logging.getLogger(__name__)


def generate_seed_combos(configs: List[Dict[str, Any]]) -> List[str]:
    """Generate seed keyword strings from [country x procedure x region] configs."""
    seeds: list[str] = []
    for config in configs:
        if not config.get("is_active", True):
            continue
        procedure = config.get("procedure_name", "")
        country = config.get("country", "")
        region = config.get("region", "")

        # Use admin-provided seed_keywords if available
        custom_seeds = config.get("seed_keywords") or []
        if custom_seeds:
            seeds.extend(custom_seeds)
        else:
            # Generate combos automatically
            if procedure and country:
                seeds.append(f"{country} {procedure}")
            if procedure and region:
                seeds.append(f"{region} {procedure}")
            if procedure:
                seeds.append(procedure)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for s in seeds:
        if s not in seen:
            seen.add(s)
            unique.append(s)
    return unique[:20]  # GKP limit


def detect_new_opportunities(
    gkp_keywords: List[Dict[str, Any]],
    existing_keywords: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Mark GKP keywords not present in existing data as 'new_opportunity'."""
    existing_set = {
        (row.get("keyword", ""), row.get("language_code", "ja"))
        for row in existing_keywords
        if row.get("source") in ("search_console", "google_ads")
    }

    for kw in gkp_keywords:
        key = (kw.get("keyword", ""), kw.get("language_code", "ja"))
        if key not in existing_set:
            kw["opportunity_flag"] = "new_opportunity"

    return gkp_keywords


def run_seed_expansion(config_ids: List[str] | None = None) -> Dict[str, Any]:
    """Run seed expansion for specified configs (or all active ones).

    Returns a summary dict with counts and warnings.
    """
    repo = get_repository()
    all_configs = repo.list_seed_configs()

    if config_ids:
        configs = [c for c in all_configs if c.get("id") in config_ids]
    else:
        configs = [c for c in all_configs if c.get("is_active", True)]

    if not configs:
        return {"expanded": 0, "new_opportunities": 0, "warnings": ["활성 시드 설정이 없습니다."]}

    seeds = generate_seed_combos(configs)
    if not seeds:
        return {"expanded": 0, "new_opportunities": 0, "warnings": ["생성된 시드 키워드가 없습니다."]}

    warnings: list[str] = []

    # Query GKP
    try:
        gkp_keywords = expand_keywords(
            seed_keywords=seeds,
            language="ja",
            limit=100,
            min_search_volume=10,
            include_high_competition=True,
        )
    except Exception as exc:
        logger.error("GKP expansion failed: %s", exc)
        return {"expanded": 0, "new_opportunities": 0, "warnings": [f"GKP 조회 실패: {exc}"]}

    if not gkp_keywords:
        return {"expanded": 0, "new_opportunities": 0, "warnings": ["GKP에서 반환된 키워드가 없습니다."]}

    # Cross-reference with existing keywords
    existing_keywords = repo.list_keywords()
    gkp_keywords = detect_new_opportunities(gkp_keywords, existing_keywords)

    # Compute weighted scores
    all_for_scoring = existing_keywords + gkp_keywords
    compute_weighted_scores(all_for_scoring)
    # Extract only the new GKP keywords (they're at the end)
    scored_new = all_for_scoring[len(existing_keywords):]

    # Save to DB
    repo.replace_keywords(scored_new)

    # Update config last_run_at
    now = datetime.utcnow().isoformat()
    for config in configs:
        config["last_run_at"] = now
        repo.upsert_seed_config(config)

    new_opps = sum(1 for kw in scored_new if kw.get("opportunity_flag") == "new_opportunity")

    return {
        "expanded": len(scored_new),
        "new_opportunities": new_opps,
        "seeds_used": seeds,
        "warnings": warnings,
    }
