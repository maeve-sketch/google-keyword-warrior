"""Content inventory service.

Syncs published content from blog_posts, computes demand-supply gap matrix,
and calculates mix ratios vs target (Hero 20% / Hub 30% / Hygiene 50%).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List
from uuid import uuid4

from app.db.repository import get_repository
from app.services.weighting_service import compute_weighted_scores


TARGET_MIX = {"hero": 20, "hub": 30, "hygiene": 50}


def sync_published_content() -> List[Dict[str, Any]]:
    """Build content inventory from existing blog_posts.

    Each blog post with content is treated as a published piece.
    The keyword and intent_segment are extracted from the post's keyword
    and matched against the keywords table.
    """
    repo = get_repository()
    posts = repo.list_blog_posts()
    keywords = repo.list_keywords()

    # Build keyword→intent lookup
    keyword_intent_map: dict[str, str] = {}
    for kw in keywords:
        keyword_intent_map[kw.get("keyword", "")] = kw.get("intent_segment") or "hygiene"

    inventory_items: list[dict[str, Any]] = []
    for post in posts:
        if not post.get("content"):
            continue
        keyword = post.get("keyword", "")
        inventory_items.append({
            "id": str(uuid4()),
            "url": post.get("published_url") or f"/draft/{post.get('id', '')}",
            "keyword": keyword,
            "title": post.get("title") or keyword,
            "intent_segment": keyword_intent_map.get(keyword, "hygiene"),
            "published_at": post.get("created_at"),
            "last_checked_at": datetime.utcnow().isoformat(),
            "status": "active",
        })

    repo.upsert_content_inventory(inventory_items)
    return inventory_items


def compute_gap_matrix() -> List[Dict[str, Any]]:
    """Compute demand (GKP search volume) vs supply (inventory) gap.

    Returns a list of gap entries sorted by gap severity (high demand, no supply first).
    """
    repo = get_repository()
    keywords = repo.list_keywords()
    inventory = repo.list_content_inventory()

    # Ensure weighted scores exist
    needs_scoring = any(kw.get("weighted_score") is None for kw in keywords)
    if needs_scoring:
        compute_weighted_scores(keywords)

    # Build set of covered keywords
    covered_keywords = {item.get("keyword", "") for item in inventory}

    gap_entries: list[dict[str, Any]] = []
    for kw in keywords:
        keyword_text = kw.get("keyword", "")
        volume = kw.get("search_volume") or kw.get("impressions") or 0
        is_covered = keyword_text in covered_keywords

        gap_entries.append({
            "keyword": keyword_text,
            "source": kw.get("source", ""),
            "intent_segment": kw.get("intent_segment", "hygiene"),
            "demand": volume,
            "weighted_score": kw.get("weighted_score", 0),
            "is_covered": is_covered,
            "opportunity_flag": kw.get("opportunity_flag"),
            "gap_severity": 0 if is_covered else volume,
        })

    # Sort: uncovered + high demand first
    gap_entries.sort(key=lambda x: (-x["gap_severity"], -x["weighted_score"]))
    return gap_entries


def compute_mix_ratio() -> Dict[str, Any]:
    """Compute actual vs target content mix ratio.

    Target: Hero 20% / Hub 30% / Hygiene 50%
    """
    repo = get_repository()
    inventory = repo.list_content_inventory()

    actual: dict[str, int] = {"hero": 0, "hub": 0, "hygiene": 0}
    for item in inventory:
        segment = item.get("intent_segment", "hygiene")
        if segment in actual:
            actual[segment] += 1

    total = sum(actual.values()) or 1  # avoid division by zero

    return {
        "actual_counts": actual,
        "actual_pct": {k: round(v / total * 100, 1) for k, v in actual.items()},
        "target_pct": TARGET_MIX,
        "total": sum(actual.values()),
        "gaps": {
            k: round(TARGET_MIX[k] - (actual[k] / total * 100), 1)
            for k in TARGET_MIX
        },
    }
