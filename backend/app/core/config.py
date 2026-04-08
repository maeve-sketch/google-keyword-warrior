from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[3]
ENV_PATH = BASE_DIR / ".env"


def load_dotenv(path: Path = ENV_PATH) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass
class Settings:
    google_ads_developer_token: str = ""
    google_ads_login_customer_id: str = ""
    google_ads_customer_id: str = ""
    google_ads_service_account_json: str = ""
    google_ads_api_version: str = "v22"
    search_console_site_url: str = "sc-domain:seyeclinic.com"
    search_console_country: str = "JPN"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    frontend_url: str = "http://localhost:5173"
    schedule_cron: str = "0 9 * * 1"
    seed_expansion_enabled: bool = True
    seed_expansion_cron: str = "0 6 * * *"


def get_settings() -> Settings:
    load_dotenv()
    return Settings(
        google_ads_developer_token=os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN", "").strip(),
        google_ads_login_customer_id=os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "").strip(),
        google_ads_customer_id=os.getenv("GOOGLE_ADS_CUSTOMER_ID", "").strip(),
        google_ads_service_account_json=os.getenv("GOOGLE_ADS_SERVICE_ACCOUNT_JSON", "").strip(),
        google_ads_api_version=os.getenv("GOOGLE_ADS_API_VERSION", "v22").strip() or "v22",
        search_console_site_url=os.getenv("SEARCH_CONSOLE_SITE_URL", "sc-domain:seyeclinic.com").strip(),
        search_console_country=os.getenv("SEARCH_CONSOLE_COUNTRY", "JPN").strip() or "JPN",
        supabase_url=os.getenv("SUPABASE_URL", "").strip(),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip(),
        frontend_url=os.getenv("FRONTEND_URL", "http://localhost:5173").strip(),
        schedule_cron=os.getenv("SCHEDULE_CRON", "0 9 * * 1").strip(),
        seed_expansion_enabled=os.getenv("SEED_EXPANSION_ENABLED", "true").strip().lower() in ("true", "1", "yes"),
        seed_expansion_cron=os.getenv("SEED_EXPANSION_CRON", "0 6 * * *").strip(),
    )
