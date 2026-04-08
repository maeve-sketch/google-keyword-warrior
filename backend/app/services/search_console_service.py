from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List
from urllib.parse import quote

import httpx
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials

from app.core.config import get_settings
from app.services.google_ads_service import matches_language, _resolve_service_account_path


SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"


def _date_range_bounds(date_range: str) -> tuple[str, str]:
    end_date = date.today() - timedelta(days=2)
    if date_range == "90d":
        start_date = end_date - timedelta(days=89)
    elif date_range == "7d":
        start_date = end_date - timedelta(days=6)
    else:
        start_date = end_date - timedelta(days=29)
    return start_date.isoformat(), end_date.isoformat()


def _previous_period_bounds(start_date: str, end_date: str) -> tuple[str, str]:
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    day_span = (end - start).days + 1
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=day_span - 1)
    return previous_start.isoformat(), previous_end.isoformat()


def _build_access_token() -> str:
    settings = get_settings()
    sa_path = _resolve_service_account_path(settings.google_ads_service_account_json)
    credentials = Credentials.from_service_account_file(
        sa_path,
        scopes=[SEARCH_CONSOLE_SCOPE],
    )
    credentials.refresh(Request())
    return credentials.token


def _query_rows(
    *,
    access_token: str,
    site_url: str,
    country: str,
    start_date: str,
    end_date: str,
    row_limit: int,
) -> List[Dict]:
    encoded_site = quote(site_url, safe="")
    url = f"https://searchconsole.googleapis.com/webmasters/v3/sites/{encoded_site}/searchAnalytics/query"
    payload = {
        "startDate": start_date,
        "endDate": end_date,
        "dimensions": ["query"],
        "rowLimit": row_limit,
        "type": "web",
        "dimensionFilterGroups": [
            {
                "groupType": "and",
                "filters": [
                    {
                        "dimension": "country",
                        "operator": "equals",
                        "expression": country,
                    }
                ],
            }
        ],
    }
    response = httpx.post(
        url,
        json=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json().get("rows", [])


LANGUAGE_COUNTRY_MAP: dict[str, str] = {
    "ja": "JPN",
    "ko": "KOR",
    "en": "USA",
    "zh-TW": "TWN",
}


def fetch_search_console_queries(date_range: str = "30d", language: str = "ja", limit: int = 50, min_impressions: int = 100) -> List[Dict]:
    settings = get_settings()
    country = LANGUAGE_COUNTRY_MAP.get(language, settings.search_console_country)
    start_date, end_date = _date_range_bounds(date_range)
    previous_start_date, previous_end_date = _previous_period_bounds(start_date, end_date)
    access_token = _build_access_token()
    rows = _query_rows(
        access_token=access_token,
        site_url=settings.search_console_site_url,
        country=country,
        start_date=start_date,
        end_date=end_date,
        row_limit=limit,
    )
    previous_rows = _query_rows(
        access_token=access_token,
        site_url=settings.search_console_site_url,
        country=country,
        start_date=previous_start_date,
        end_date=previous_end_date,
        row_limit=max(limit * 3, 200),
    )
    previous_impressions_by_query = {
        row.get("keys", [""])[0]: int(row.get("impressions", 0) or 0)
        for row in previous_rows
    }

    normalized: List[Dict] = []
    for row in rows:
        keyword = row.get("keys", [""])[0]
        if not matches_language(keyword, language):
            continue
        clicks = float(row.get("clicks", 0) or 0)
        impressions = int(row.get("impressions", 0) or 0)
        if impressions < min_impressions:
            continue
        previous_impressions = previous_impressions_by_query.get(keyword, 0)
        if previous_impressions > 0:
            impression_delta_pct = round(((impressions - previous_impressions) / previous_impressions) * 100, 2)
        elif impressions > 0:
            impression_delta_pct = 100.0
        else:
            impression_delta_pct = 0.0
        ctr = round(float((row.get("ctr", 0) or 0) * 100), 2)
        position = round(float(row.get("position", 0) or 0), 2)
        normalized.append(
            {
                "keyword": keyword,
                "source": "search_console",
                "parent_keyword": None,
                "search_volume": impressions,
                "competition_level": None,
                "competition_index": None,
                "avg_cpc": None,
                "conversions": 0,
                "clicks": clicks,
                "conversion_rate": ctr,
                "language_code": language,
                "geo_target": country,
                "status": "pending",
                "fetched_at": end_date,
                "position": position,
                "impressions": impressions,
                "previous_impressions": previous_impressions,
                "impression_delta_pct": impression_delta_pct,
                "ctr": ctr,
            }
        )
    return normalized
