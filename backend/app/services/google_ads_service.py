from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Dict, List

from google.ads.googleads.client import GoogleAdsClient

from app.core.config import get_settings


def _normalize_customer_id(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


_JP_PATTERN = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]")
_KO_PATTERN = re.compile(r"[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]")
_EN_PATTERN = re.compile(r"[A-Za-z]")
_ZH_PATTERN = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")

LANGUAGE_GEO_MAP: dict[str, str] = {
    "ja": "JP",
    "ko": "KR",
    "en": "US",
    "zh-TW": "TW",
}


def matches_language(keyword: str, language: str) -> bool:
    text = keyword or ""
    if language == "ja":
        return bool(_JP_PATTERN.search(text))
    if language == "ko":
        return bool(_KO_PATTERN.search(text))
    if language == "en":
        return bool(_EN_PATTERN.search(text)) and not _JP_PATTERN.search(text) and not _KO_PATTERN.search(text)
    if language == "zh-TW":
        return bool(_ZH_PATTERN.search(text)) and not _JP_PATTERN.search(text.replace("", "")) or bool(_ZH_PATTERN.search(text))
    return True


_cached_sa_path: str | None = None


def _resolve_service_account_path(raw: str) -> str:
    """Accept a file path OR raw JSON string for the service account.

    If the value looks like JSON (starts with '{'), write it to a fixed temp
    file once and reuse the path on subsequent calls. No file accumulation.
    """
    global _cached_sa_path
    stripped = raw.strip()
    if not stripped.startswith("{"):
        return stripped
    if _cached_sa_path is not None:
        return _cached_sa_path
    import os
    import tempfile
    path = os.path.join(tempfile.gettempdir(), "gkw_service_account.json")
    with open(path, "w", encoding="utf-8") as f:
        f.write(stripped)
    _cached_sa_path = path
    return path


def build_client() -> GoogleAdsClient:
    settings = get_settings()
    sa_path = _resolve_service_account_path(settings.google_ads_service_account_json)
    return GoogleAdsClient.load_from_dict(
        {
            "developer_token": settings.google_ads_developer_token,
            "login_customer_id": _normalize_customer_id(settings.google_ads_login_customer_id),
            "json_key_file_path": sa_path,
            "use_proto_plus": True,
        },
        version=settings.google_ads_api_version,
    )


def _build_date_filter(date_range: str) -> str:
    if date_range == "7d":
        return "segments.date DURING LAST_7_DAYS"
    if date_range == "90d":
        end_date = date.today() - timedelta(days=1)
        start_date = end_date - timedelta(days=89)
        return f"segments.date BETWEEN '{start_date.isoformat()}' AND '{end_date.isoformat()}'"
    return "segments.date DURING LAST_30_DAYS"


def fetch_converting_search_terms(
    date_range: str = "30d",
    limit: int = 50,
    language: str = "ja",
    min_clicks: int = 10,
    min_spend: float = 0.0,
) -> List[Dict]:
    settings = get_settings()
    client = build_client()
    service = client.get_service("GoogleAdsService")
    customer_id = _normalize_customer_id(settings.google_ads_customer_id)
    query = f"""
        SELECT
          search_term_view.search_term,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions,
          metrics.cost_micros,
          metrics.average_cpc
        FROM search_term_view
        WHERE {_build_date_filter(date_range)}
        ORDER BY metrics.conversions DESC, metrics.clicks DESC
        LIMIT {limit}
    """
    response = service.search(customer_id=customer_id, query=query)
    candidate_rows: List[Dict] = []
    for row in response:
        keyword = row.search_term_view.search_term
        if not matches_language(keyword, language):
            continue
        clicks = row.metrics.clicks or 0
        impressions = row.metrics.impressions or 0
        conversions = float(row.metrics.conversions or 0)
        spend = round((row.metrics.cost_micros or 0) / 1_000_000, 2)
        ctr = round((clicks / impressions) * 100, 2) if impressions else 0.0
        conversion_rate = round((conversions / clicks) * 100, 2) if clicks else 0.0
        candidate_rows.append(
            {
                "keyword": keyword,
                "source": "google_ads",
                "parent_keyword": None,
                "search_volume": impressions,
                "competition_level": None,
                "competition_index": None,
                "avg_cpc": round((row.metrics.average_cpc or 0) / 1_000_000, 2),
                "conversions": conversions,
                "clicks": clicks,
                "conversion_rate": conversion_rate,
                "impressions": impressions,
                "ctr": ctr,
                "spend": spend,
                "language_code": language,
                "geo_target": LANGUAGE_GEO_MAP.get(language, "JP"),
                "status": "pending",
                "fetched_at": date.today().isoformat(),
            }
        )
    average_ctr = sum(row["ctr"] for row in candidate_rows) / len(candidate_rows) if candidate_rows else 0.0
    rows: List[Dict] = []
    for row in candidate_rows:
        qualifies = (
            row["conversions"] > 0
            or (row["clicks"] >= min_clicks and row["ctr"] >= average_ctr)
            or row["spend"] >= min_spend
        )
        if qualifies:
            rows.append(row)
    return rows
