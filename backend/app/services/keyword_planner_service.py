from __future__ import annotations

from datetime import date
from typing import Dict, Iterable, List

from app.services.google_ads_service import build_client, _normalize_customer_id, matches_language, LANGUAGE_GEO_MAP

_COUNTRY_CANONICAL: dict[str, str] = {
    "JP": "Japan",
    "KR": "South Korea",
    "US": "United States",
    "TW": "Taiwan",
}
from app.core.config import get_settings


def _lookup_language_resource_name(client, customer_id: str, language_code: str) -> str:
    service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT language_constant.resource_name
        FROM language_constant
        WHERE language_constant.code = '{language_code}'
        LIMIT 1
    """
    response = service.search(customer_id=customer_id, query=query)
    for row in response:
        return row.language_constant.resource_name
    raise ValueError("Language constant not found")


def _lookup_country_resource_name(client, customer_id: str, country_code: str) -> str:
    service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT geo_target_constant.resource_name
        FROM geo_target_constant
        WHERE geo_target_constant.country_code = '{country_code}'
          AND geo_target_constant.canonical_name = '{_COUNTRY_CANONICAL.get(country_code, country_code)}'
          AND geo_target_constant.status = 'ENABLED'
        LIMIT 1
    """
    response = service.search(customer_id=customer_id, query=query)
    for row in response:
        return row.geo_target_constant.resource_name
    raise ValueError("Geo target not found")


def _map_competition(value) -> str:
    name = str(value.name).upper()
    if name.endswith("HIGH"):
        return "HIGH"
    if name.endswith("MEDIUM"):
        return "MEDIUM"
    return "LOW"


def _percentile(values: List[float], fraction: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = max(0, min(len(sorted_values) - 1, int((len(sorted_values) - 1) * fraction)))
    return sorted_values[index]


def expand_keywords(
    seed_keywords: Iterable[str],
    language: str = "ja",
    limit: int = 100,
    min_search_volume: int = 10,
    include_high_competition: bool = True,
) -> List[Dict]:
    seed_list = [keyword for keyword in seed_keywords if keyword][:20]
    if not seed_list:
        return []

    settings = get_settings()
    client = build_client()
    customer_id = _normalize_customer_id(settings.google_ads_customer_id)
    keyword_plan_service = client.get_service("KeywordPlanIdeaService")
    # GKP uses underscores (zh_TW), frontend uses hyphens (zh-TW)
    gkp_language_code = language.replace("-", "_")
    language_resource = _lookup_language_resource_name(client, customer_id, gkp_language_code)
    geo_code = LANGUAGE_GEO_MAP.get(language, "JP")
    geo_resource = _lookup_country_resource_name(client, customer_id, geo_code)

    request = client.get_type("GenerateKeywordIdeasRequest")
    request.customer_id = customer_id
    request.language = language_resource
    request.geo_target_constants.append(geo_resource)
    request.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
    request.keyword_seed.keywords.extend(seed_list)

    response = keyword_plan_service.generate_keyword_ideas(request=request)
    candidates: List[Dict] = []
    for idx, result in enumerate(response):
        if idx >= limit:
            break
        metrics = result.keyword_idea_metrics
        avg_monthly_searches = metrics.avg_monthly_searches or 0
        competition = _map_competition(metrics.competition)
        avg_cpc = round(float(((metrics.low_top_of_page_bid_micros or 0) + (metrics.high_top_of_page_bid_micros or 0)) / 2 / 1_000_000), 2)
        if not matches_language(result.text, language):
            continue
        if not include_high_competition and competition == "HIGH":
            continue
        candidates.append(
            {
                "keyword": result.text,
                "source": "keyword_planner",
                "parent_keyword": seed_list[0] if seed_list else None,
                "search_volume": avg_monthly_searches,
                "competition_level": competition,
                "competition_index": round(float((metrics.competition_index or 0) / 100), 2),
                "avg_cpc": avg_cpc,
                "conversions": 0,
                "clicks": 0,
                "conversion_rate": 0,
                "language_code": language,
                "geo_target": geo_code,
                "status": "pending",
                "fetched_at": date.today().isoformat(),
            }
        )
    cpc_cutoff = _percentile([row["avg_cpc"] for row in candidates if row["avg_cpc"]], 0.8)
    rows: List[Dict] = []
    for row in candidates:
        if row["search_volume"] > max(10, min_search_volume) or (row["avg_cpc"] >= cpc_cutoff and row["search_volume"] >= 10):
            rows.append(row)
    return rows
