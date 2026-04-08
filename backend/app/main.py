from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routes import blog, inventory, keywords, scheduler


settings = get_settings()
app = FastAPI(title="Google Keyword Warrior API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        *[u.strip() for u in (settings.extra_cors_origins or "").split(",") if u.strip()],
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(keywords.router, prefix="/api/keywords", tags=["keywords"])
app.include_router(blog.router, prefix="/api/blog", tags=["blog"])
app.include_router(scheduler.router, prefix="/api/scheduler", tags=["scheduler"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "storage": "supabase" if settings.supabase_url and settings.supabase_service_role_key else "local",
    }
