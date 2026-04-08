"""Strategic weighting engine (GKP 50% / GSC 30% / Ads 20%).

Computes a composite weighted_score, weight_multiplier, intent_segment,
and opportunity_flag for each keyword based on the PRD specifications.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

# ---- Intent classification patterns ----

_HERO_PATTERN = re.compile(
    r"(비용|가격|料金|値段|予約|상담|package|패키지|event|이벤트)", re.IGNORECASE
)
_HUB_PATTERN = re.compile(
    r"(비교|比較|違い|vs|추천|おすすめ|効果|持続|痛み|ダウンタイム|何ショット)", re.IGNORECASE
)
_HYGIENE_PATTERN = re.compile(
    r"(원인|原因|관리|ケア|후기|口コミ|부작용|副作用|faq|주의|注意)", re.IGNORECASE
)


def _percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = max(0, min(len(sorted_values) - 1, int((len(sorted_values) - 1) * fraction)))
    return sorted_values[index]


def _classify_intent(keyword: Dict[str, Any]) -> str:
    """Classify a keyword into Hero / Hub / Hygiene."""
    text = keyword.get("keyword", "")

    if _HERO_PATTERN.search(text):
        return "hero"
    if _HUB_PATTERN.search(text):
        return "hub"
    if _HYGIENE_PATTERN.search(text):
        return "hygiene"

    # Ads converting keywords → Hero
    source = keyword.get("source", "")
    if source == "google_ads":
        conversions = float(keyword.get("conversions") or 0)
        avg_cpc = float(keyword.get("avg_cpc") or 0)
        if conversions > 0 or avg_cpc >= 500:
            return "hero"

    return "hygiene"


def _determine_opportunity_flag(keyword: Dict[str, Any]) -> str | None:
    """Determine opportunity flag based on source data."""
    source = keyword.get("source", "")

    # Ads: converting keyword → hero_locked
    if source == "google_ads" and float(keyword.get("conversions") or 0) > 0:
        return "hero_locked"

    # GSC: position 11-30 → rewrite_candidate
    if source == "search_console":
        position = float(keyword.get("position") or 999)
        if 11 <= position <= 30:
            return "rewrite_candidate"

    return None


def compute_weighted_scores(keywords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Apply PRD strategic weighting (GKP 50% / GSC 30% / Ads 20%) to all keywords.

    Mutates each keyword dict in-place and returns the list.
    """
    # Build context: top 20% CPC cutoff from GKP keywords
    planner_cpcs = [
        float(kw.get("avg_cpc") or 0)
        for kw in keywords
        if kw.get("source") == "keyword_planner" and float(kw.get("avg_cpc") or 0) > 0
    ]
    top_cpc_cutoff = _percentile(planner_cpcs, 0.8)

    # GSC high impressions cutoff (top 30%)
    gsc_impressions = [
        float(kw.get("impressions") or 0)
        for kw in keywords
        if kw.get("source") == "search_console" and float(kw.get("impressions") or 0) > 0
    ]
    high_impressions_cutoff = _percentile(gsc_impressions, 0.7)

    # Ads average CTR
    ads_ctrs = [
        float(kw.get("ctr") or 0)
        for kw in keywords
        if kw.get("source") == "google_ads" and float(kw.get("ctr") or 0) >= 0
    ]
    ads_avg_ctr = (sum(ads_ctrs) / len(ads_ctrs)) if ads_ctrs else 0.0

    # Ads high spend cutoff (top 30%)
    ads_spends = [
        float(kw.get("spend") or 0)
        for kw in keywords
        if kw.get("source") == "google_ads" and float(kw.get("spend") or 0) > 0
    ]
    high_spend_cutoff = _percentile(ads_spends, 0.7)

    for kw in keywords:
        intent = _classify_intent(kw)
        source = kw.get("source", "")

        # Base score by segment
        score = {"hero": 10, "hub": 6, "hygiene": 4}.get(intent, 4)
        multiplier = 1.0

        # --- GKP (50% weight) ---
        if source == "keyword_planner":
            score += 50
            volume = float(kw.get("search_volume") or 0)
            cpc = float(kw.get("avg_cpc") or 0)

            # Long-tail focus: 10-500
            if 10 <= volume <= 500:
                score += 12
            elif volume > 500:
                score += 6

            # Competition bonus
            comp = (kw.get("competition_level") or "").upper()
            if comp == "HIGH":
                score += 6
            elif comp == "MEDIUM":
                score += 3

            # Bid top 20% → 1.5x multiplier (PRD spec)
            if top_cpc_cutoff > 0 and cpc >= top_cpc_cutoff:
                multiplier = 1.5
                score += 18

        # --- GSC (30% weight) ---
        elif source == "search_console":
            score += 30
            impressions = float(kw.get("impressions") or 0)
            delta = float(kw.get("impression_delta_pct") or 0)
            position = float(kw.get("position") or 999)

            # Impression surge (+20% week-over-week)
            if delta >= 20:
                score += 16

            # Position 11-30 → rewrite candidate
            if 11 <= position <= 30:
                score += 16
            elif position <= 10:
                score += 7

            # High impressions bonus
            if high_impressions_cutoff > 0 and impressions >= high_impressions_cutoff:
                score += 8

        # --- Ads (20% weight) ---
        elif source == "google_ads":
            score += 20
            conversions = float(kw.get("conversions") or 0)
            ctr = float(kw.get("ctr") or 0)
            spend = float(kw.get("spend") or 0)

            # Converting keyword → hero lock
            if conversions > 0:
                score += 20

            # Above-average CTR
            if ads_avg_ctr > 0 and ctr >= ads_avg_ctr:
                score += 10

            # High spend
            if high_spend_cutoff > 0 and spend >= high_spend_cutoff:
                score += 8

        # Apply multiplier
        final_score = round(score * multiplier, 2)

        kw["weighted_score"] = final_score
        kw["weight_multiplier"] = multiplier
        kw["intent_segment"] = intent
        kw["opportunity_flag"] = _determine_opportunity_flag(kw)

    return keywords
