from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List


DATA_DIR = Path(__file__).resolve().parents[2] / "storage"
KEYWORDS_PATH = DATA_DIR / "keywords.json"
BLOG_POSTS_PATH = DATA_DIR / "blog_posts.json"
SEED_CONFIGS_PATH = DATA_DIR / "seed_configs.json"
CONTENT_INVENTORY_PATH = DATA_DIR / "content_inventory.json"
KEYWORD_HISTORY_PATH = DATA_DIR / "keyword_history.json"


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read(path: Path) -> List[Dict[str, Any]]:
    _ensure_data_dir()
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, rows: List[Dict[str, Any]]) -> None:
    _ensure_data_dir()
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def list_keywords() -> List[Dict[str, Any]]:
    return _read(KEYWORDS_PATH)


def save_keywords(rows: List[Dict[str, Any]]) -> None:
    _write(KEYWORDS_PATH, rows)


def list_blog_posts() -> List[Dict[str, Any]]:
    return _read(BLOG_POSTS_PATH)


def save_blog_posts(rows: List[Dict[str, Any]]) -> None:
    _write(BLOG_POSTS_PATH, rows)


def list_seed_configs() -> List[Dict[str, Any]]:
    return _read(SEED_CONFIGS_PATH)


def save_seed_configs(rows: List[Dict[str, Any]]) -> None:
    _write(SEED_CONFIGS_PATH, rows)


def list_content_inventory() -> List[Dict[str, Any]]:
    return _read(CONTENT_INVENTORY_PATH)


def save_content_inventory(rows: List[Dict[str, Any]]) -> None:
    _write(CONTENT_INVENTORY_PATH, rows)


def list_keyword_history() -> List[Dict[str, Any]]:
    return _read(KEYWORD_HISTORY_PATH)


def save_keyword_history(rows: List[Dict[str, Any]]) -> None:
    _write(KEYWORD_HISTORY_PATH, rows)
