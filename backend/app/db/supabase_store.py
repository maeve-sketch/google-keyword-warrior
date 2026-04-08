from __future__ import annotations

from typing import Any, Dict, List

import httpx


class SupabaseStore:
    def __init__(self, url: str, service_role_key: str) -> None:
        self.base_url = url.rstrip("/")
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, *, params: Dict[str, Any] | None = None, json: Any = None, headers: Dict[str, str] | None = None) -> Any:
        merged_headers = dict(self.headers)
        if headers:
            merged_headers.update(headers)
        response = httpx.request(
            method,
            f"{self.base_url}{path}",
            params=params,
            json=json,
            headers=merged_headers,
            timeout=30.0,
        )
        response.raise_for_status()
        if not response.text:
            return None
        return response.json()

    def list_keywords(self) -> List[Dict[str, Any]]:
        rows = self._request(
            "GET",
            "/rest/v1/keywords",
            params={"select": "*", "order": "fetched_at.desc"},
        )
        return rows or []

    def upsert_keywords(self, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        self._request(
            "POST",
            "/rest/v1/keywords",
            json=rows,
            headers={"Prefer": "resolution=merge-duplicates"},
        )

    def delete_keyword(self, keyword_id: str) -> None:
        self._request("DELETE", "/rest/v1/keywords", params={"id": f"eq.{keyword_id}"})

    def list_blog_posts(self) -> List[Dict[str, Any]]:
        rows = self._request(
            "GET",
            "/rest/v1/blog_posts",
            params={"select": "*", "order": "updated_at.desc"},
        )
        return rows or []

    def upsert_blog_posts(self, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        self._request(
            "POST",
            "/rest/v1/blog_posts",
            json=rows,
            headers={"Prefer": "resolution=merge-duplicates"},
        )

    # --- seed_expansion_configs ---

    def list_seed_configs(self) -> List[Dict[str, Any]]:
        rows = self._request(
            "GET",
            "/rest/v1/seed_expansion_configs",
            params={"select": "*", "order": "created_at.desc"},
        )
        return rows or []

    def upsert_seed_configs(self, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        self._request(
            "POST",
            "/rest/v1/seed_expansion_configs",
            json=rows,
            headers={"Prefer": "resolution=merge-duplicates"},
        )

    def delete_seed_config(self, config_id: str) -> None:
        self._request("DELETE", "/rest/v1/seed_expansion_configs", params={"id": f"eq.{config_id}"})

    # --- content_inventory ---

    def list_content_inventory(self) -> List[Dict[str, Any]]:
        rows = self._request(
            "GET",
            "/rest/v1/content_inventory",
            params={"select": "*", "order": "published_at.desc"},
        )
        return rows or []

    def upsert_content_inventory(self, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        self._request(
            "POST",
            "/rest/v1/content_inventory",
            json=rows,
            headers={"Prefer": "resolution=merge-duplicates"},
        )

    # --- keyword_history ---

    def list_keyword_history(self) -> List[Dict[str, Any]]:
        rows = self._request(
            "GET",
            "/rest/v1/keyword_history",
            params={"select": "*", "order": "snapshot_date.desc"},
        )
        return rows or []

    def upsert_keyword_history(self, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        self._request(
            "POST",
            "/rest/v1/keyword_history",
            json=rows,
            headers={"Prefer": "resolution=merge-duplicates"},
        )
