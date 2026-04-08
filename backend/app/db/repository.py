from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.core.config import get_settings
from app.db.local_store import (
    list_blog_posts, list_keywords, save_blog_posts, save_keywords,
    list_seed_configs, save_seed_configs,
    list_content_inventory, save_content_inventory,
    list_keyword_history, save_keyword_history,
)
from app.db.supabase_store import SupabaseStore


def _now() -> str:
    return datetime.utcnow().isoformat()


def _keyword_signature(row: Dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        row.get("keyword", ""),
        row.get("source", ""),
        row.get("language_code", "ja"),
        row.get("geo_target", "JP"),
    )


class Repository:
    def list_keywords(self) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def replace_keywords(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def update_keyword_status(self, keyword_id: str, status: str) -> Dict[str, Any] | None:
        raise NotImplementedError

    def delete_keyword(self, keyword_id: str) -> Dict[str, Any] | None:
        raise NotImplementedError

    def list_blog_posts(self) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def update_blog_post(self, blog_id: str, patch: Dict[str, Any]) -> Dict[str, Any] | None:
        raise NotImplementedError

    def append_blog_post(self, post: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    # --- seed_expansion_configs ---
    def list_seed_configs(self) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def upsert_seed_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def delete_seed_config(self, config_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    # --- content_inventory ---
    def list_content_inventory(self) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def upsert_content_inventory(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        raise NotImplementedError

    # --- keyword_history ---
    def list_keyword_history(self) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def append_keyword_history(self, snapshots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        raise NotImplementedError


class LocalRepository(Repository):
    def list_keywords(self) -> List[Dict[str, Any]]:
        return list_keywords()

    def replace_keywords(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        existing = {_keyword_signature(row): row for row in list_keywords()}
        merged: List[Dict[str, Any]] = []
        for row in rows:
            previous = existing.get(_keyword_signature(row), {})
            merged_row = {
                **row,
                "id": previous.get("id", str(uuid4())),
                "created_at": previous.get("created_at", _now()),
                "status": previous.get("status", row.get("status", "pending")),
            }
            merged.append(merged_row)
        save_keywords(merged)
        return merged

    def update_keyword_status(self, keyword_id: str, status: str) -> Dict[str, Any] | None:
        rows = list_keywords()
        for row in rows:
            if row.get("id") != keyword_id:
                continue
            row["status"] = status
            save_keywords(rows)
            return row
        return None

    def delete_keyword(self, keyword_id: str) -> Dict[str, Any] | None:
        rows = list_keywords()
        kept: List[Dict[str, Any]] = []
        removed: Dict[str, Any] | None = None
        for row in rows:
            if row.get("id") == keyword_id and removed is None:
                removed = row
                continue
            kept.append(row)
        if removed is not None:
            save_keywords(kept)
        return removed

    def list_blog_posts(self) -> List[Dict[str, Any]]:
        return list_blog_posts()

    def update_blog_post(self, blog_id: str, patch: Dict[str, Any]) -> Dict[str, Any] | None:
        rows = list_blog_posts()
        for row in rows:
            if row.get("id") != blog_id:
                continue
            row.update(patch)
            row["updated_at"] = _now()
            save_blog_posts(rows)
            return row
        return None

    def append_blog_post(self, post: Dict[str, Any]) -> Dict[str, Any]:
        rows = list_blog_posts()
        rows.append(post)
        save_blog_posts(rows)
        return post


    # --- seed_expansion_configs ---
    def list_seed_configs(self) -> List[Dict[str, Any]]:
        return list_seed_configs()

    def upsert_seed_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        rows = list_seed_configs()
        for i, row in enumerate(rows):
            if row.get("id") == config.get("id"):
                rows[i] = {**row, **config}
                save_seed_configs(rows)
                return rows[i]
        config.setdefault("id", str(uuid4()))
        config.setdefault("created_at", _now())
        rows.append(config)
        save_seed_configs(rows)
        return config

    def delete_seed_config(self, config_id: str) -> Optional[Dict[str, Any]]:
        rows = list_seed_configs()
        removed = None
        kept = []
        for row in rows:
            if row.get("id") == config_id and removed is None:
                removed = row
            else:
                kept.append(row)
        if removed is not None:
            save_seed_configs(kept)
        return removed

    # --- content_inventory ---
    def list_content_inventory(self) -> List[Dict[str, Any]]:
        return list_content_inventory()

    def upsert_content_inventory(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        existing = {row.get("url"): row for row in list_content_inventory()}
        for item in items:
            item.setdefault("id", str(uuid4()))
            url = item.get("url")
            if url and url in existing:
                item["id"] = existing[url]["id"]
            existing[url] = item
        result = list(existing.values())
        save_content_inventory(result)
        return result

    # --- keyword_history ---
    def list_keyword_history(self) -> List[Dict[str, Any]]:
        return list_keyword_history()

    def append_keyword_history(self, snapshots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        rows = list_keyword_history()
        for snap in snapshots:
            snap.setdefault("id", str(uuid4()))
            rows.append(snap)
        save_keyword_history(rows)
        return snapshots


class SupabaseRepository(Repository):
    def __init__(self, store: SupabaseStore) -> None:
        self.store = store

    def list_keywords(self) -> List[Dict[str, Any]]:
        return self.store.list_keywords()

    def replace_keywords(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        existing = {_keyword_signature(row): row for row in self.store.list_keywords()}
        merged: List[Dict[str, Any]] = []
        for row in rows:
            previous = existing.get(_keyword_signature(row), {})
            merged_row = {
                **row,
                "id": previous.get("id", str(uuid4())),
                "created_at": previous.get("created_at", _now()),
                "status": previous.get("status", row.get("status", "pending")),
            }
            merged.append(merged_row)
        self.store.upsert_keywords(merged)
        return merged

    def update_keyword_status(self, keyword_id: str, status: str) -> Dict[str, Any] | None:
        rows = self.store.list_keywords()
        for row in rows:
            if row.get("id") != keyword_id:
                continue
            row["status"] = status
            self.store.upsert_keywords([row])
            return row
        return None

    def delete_keyword(self, keyword_id: str) -> Dict[str, Any] | None:
        rows = self.store.list_keywords()
        removed = next((row for row in rows if row.get("id") == keyword_id), None)
        if removed is not None:
            self.store.delete_keyword(keyword_id)
        return removed

    def list_blog_posts(self) -> List[Dict[str, Any]]:
        return self.store.list_blog_posts()

    def update_blog_post(self, blog_id: str, patch: Dict[str, Any]) -> Dict[str, Any] | None:
        rows = self.store.list_blog_posts()
        for row in rows:
            if row.get("id") != blog_id:
                continue
            row.update(patch)
            row["updated_at"] = _now()
            self.store.upsert_blog_posts([row])
            return row
        return None

    def append_blog_post(self, post: Dict[str, Any]) -> Dict[str, Any]:
        self.store.upsert_blog_posts([post])
        return post


    # --- seed_expansion_configs ---
    def list_seed_configs(self) -> List[Dict[str, Any]]:
        return self.store.list_seed_configs()

    def upsert_seed_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        config.setdefault("id", str(uuid4()))
        config.setdefault("created_at", _now())
        self.store.upsert_seed_configs([config])
        return config

    def delete_seed_config(self, config_id: str) -> Optional[Dict[str, Any]]:
        configs = self.store.list_seed_configs()
        removed = next((c for c in configs if c.get("id") == config_id), None)
        if removed is not None:
            self.store.delete_seed_config(config_id)
        return removed

    # --- content_inventory ---
    def list_content_inventory(self) -> List[Dict[str, Any]]:
        return self.store.list_content_inventory()

    def upsert_content_inventory(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        for item in items:
            item.setdefault("id", str(uuid4()))
        self.store.upsert_content_inventory(items)
        return items

    # --- keyword_history ---
    def list_keyword_history(self) -> List[Dict[str, Any]]:
        return self.store.list_keyword_history()

    def append_keyword_history(self, snapshots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        for snap in snapshots:
            snap.setdefault("id", str(uuid4()))
        self.store.upsert_keyword_history(snapshots)
        return snapshots


def get_repository() -> Repository:
    settings = get_settings()
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseRepository(SupabaseStore(settings.supabase_url, settings.supabase_service_role_key))
    return LocalRepository()
