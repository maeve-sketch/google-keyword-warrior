from __future__ import annotations

import json
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.db.repository import get_repository
from app.services.claude_service import map_claude_http_error, stream_claude_draft
from app.services.gemini_service import stream_blog_draft
import httpx


router = APIRouter()


class GenerateBlogBody(BaseModel):
    keywordIds: List[str] = []
    language: str = "ja"
    tone: str = "신뢰감 있는 전문 톤"
    speaker: str = "none"
    customInstruction: str = ""
    clinicName: str = "セイェクリニック"
    llmProvider: str = "gemini"
    apiKey: str
    modelMode: str = "fast"
    requestSpeed: str = "relaxed"
    manualKeyword: str = ""
    manualRelatedKeywords: List[str] = []
    intentSegment: str = "auto"


class UpdateBlogBody(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None


@router.get("")
def get_blog_posts(status: Optional[str] = None, keyword: Optional[str] = None) -> dict:
    repository = get_repository()
    rows = repository.list_blog_posts()
    filtered = []
    for row in rows:
        if status and row.get("status") != status:
            continue
        if keyword and keyword not in row.get("keyword", ""):
            continue
        filtered.append(row)
    return {"posts": filtered, "total": len(filtered)}


@router.get("/{blog_id}")
def get_blog_post(blog_id: str) -> dict:
    repository = get_repository()
    for row in repository.list_blog_posts():
        if row.get("id") == blog_id:
            return row
    raise HTTPException(status_code=404, detail="Blog post not found")


@router.patch("/{blog_id}")
def patch_blog_post(blog_id: str, body: UpdateBlogBody) -> dict:
    repository = get_repository()
    patch: dict = {}
    if body.title is not None:
        patch["title"] = body.title
    if body.content is not None:
        patch["content"] = body.content
    if body.status is not None:
        patch["status"] = body.status
    row = repository.update_blog_post(blog_id, patch)
    if row is not None:
        return {"ok": True, "post": row}
    raise HTTPException(status_code=404, detail="Blog post not found")


@router.post("/generate")
def generate_blog(body: GenerateBlogBody) -> StreamingResponse:
    repository = get_repository()
    if not body.apiKey.strip():
        raise HTTPException(status_code=400, detail="apiKey is required")

    keywords = repository.list_keywords()
    selected_keywords = [row for row in keywords if row.get("id") in body.keywordIds]
    manual_keyword = body.manualKeyword.strip()

    if selected_keywords:
        primary_keyword = selected_keywords[0]["keyword"]
        primary_keyword_id = selected_keywords[0].get("id")
        related_keywords = [row.get("keyword", "") for row in selected_keywords[1:6]]
    elif manual_keyword:
        primary_keyword = manual_keyword
        primary_keyword_id = None
        related_keywords = [item for item in body.manualRelatedKeywords if item][:5]
    else:
        raise HTTPException(status_code=400, detail="No valid keywords selected and no manual keyword provided")

    async def event_stream():
        chunks: List[str] = []
        try:
            # Resolve intent: if auto, look up from keyword data
            intent = body.intentSegment
            if intent == "auto" and selected_keywords:
                intent = selected_keywords[0].get("intent_segment") or "auto"

            if body.llmProvider == "claude":
                async for chunk in stream_claude_draft(
                    claude_api_key=body.apiKey,
                    clinic_name=body.clinicName,
                    keyword=primary_keyword,
                    related_keywords=related_keywords,
                    tone=body.tone,
                    speaker=body.speaker,
                    custom_instruction=body.customInstruction,
                    model_mode=body.modelMode,
                    request_speed=body.requestSpeed,
                    intent_segment=intent,
                ):
                    chunks.append(chunk)
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk}, ensure_ascii=False)}\n\n"
            else:
                async for chunk in stream_blog_draft(
                    gemini_api_key=body.apiKey,
                    clinic_name=body.clinicName,
                    keyword=primary_keyword,
                    related_keywords=related_keywords,
                    tone=body.tone,
                    speaker=body.speaker,
                    custom_instruction=body.customInstruction,
                    model_mode=body.modelMode,
                    request_speed=body.requestSpeed,
                    intent_segment=intent,
                ):
                    chunks.append(chunk)
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk}, ensure_ascii=False)}\n\n"
        except httpx.HTTPStatusError as exc:
            message = map_claude_http_error(exc) if body.llmProvider == "claude" else str(exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(message)}, ensure_ascii=False)}\n\n"
            return
        except Exception as exc:  # pragma: no cover - surfaced to UI via SSE
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)}, ensure_ascii=False)}\n\n"
            return

        post_id = str(uuid4())
        saved = {
            "id": post_id,
            "keyword_id": primary_keyword_id,
            "keyword": primary_keyword,
            "title": "",
            "content": "".join(chunks),
            "meta_description": "",
            "target_language": body.language,
            "prompt_used": (
                f"provider={body.llmProvider}; keyword={primary_keyword}; related={','.join(related_keywords)}; "
                f"tone={body.tone}; speaker={body.speaker}; speed={body.requestSpeed}; custom={body.customInstruction}"
            ),
            "status": "draft",
            "published_url": None,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        repository.append_blog_post(saved)
        yield f"data: {json.dumps({'type': 'done', 'blogId': post_id}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
