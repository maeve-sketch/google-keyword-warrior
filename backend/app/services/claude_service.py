from __future__ import annotations

import json
from http import HTTPStatus
from typing import AsyncIterator, List

import httpx

from app.services.llm_prompt import build_blog_prompt, build_continuation_prompt, is_draft_complete


CLAUDE_FAST_MODEL = "claude-3-5-haiku-latest"
CLAUDE_QUALITY_MODEL = "claude-sonnet-4-20250514"


def resolve_claude_model(model_mode: str) -> str:
    if model_mode == "quality":
        return CLAUDE_QUALITY_MODEL
    if model_mode == "balanced":
        return CLAUDE_QUALITY_MODEL
    return CLAUDE_FAST_MODEL


async def stream_claude_draft(
    claude_api_key: str,
    clinic_name: str,
    keyword: str,
    related_keywords: List[str],
    tone: str,
    speaker: str,
    custom_instruction: str,
    model_mode: str = "fast",
    request_speed: str = "relaxed",
    intent_segment: str = "auto",
) -> AsyncIterator[str]:
    prompt = build_blog_prompt(clinic_name, keyword, related_keywords, tone, speaker, custom_instruction, intent_segment=intent_segment)
    model_name = resolve_claude_model(model_mode)
    async with httpx.AsyncClient(timeout=80.0) as client:
        accumulated = ""
        current_prompt = prompt
        for attempt in range(5):
            text = await _stream_claude_once(
                client=client,
                claude_api_key=claude_api_key,
                model_name=model_name,
                model_mode=model_mode,
                request_speed=request_speed,
                prompt=current_prompt,
            )
            accumulated += text
            if text:
                yield text
            if is_draft_complete(accumulated):
                return
            current_prompt = build_continuation_prompt(accumulated)

        if accumulated:
            yield "\n\n[EDITOR_NOTE: 자동 이어쓰기를 최대치까지 수행했습니다. FAQ/마무리/메타가 비었는지 마지막만 확인해 주세요.]"
            return


async def _stream_claude_once(
    client: httpx.AsyncClient,
    claude_api_key: str,
    model_name: str,
    model_mode: str,
    request_speed: str,
    prompt: str,
) -> str:
    payload = {
        "model": model_name,
        "max_tokens": resolve_claude_max_tokens(model_mode, request_speed),
        "stream": True,
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
    }
    collected = ""
    async with client.stream(
        "POST",
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": claude_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=payload,
    ) as response:
        response.raise_for_status()
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            raw = line.replace("data: ", "", 1).strip()
            if not raw or raw == "[DONE]":
                continue
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "content_block_delta":
                delta = event.get("delta", {})
                text = delta.get("text", "")
                if text:
                    collected += text
    return collected


def resolve_claude_max_tokens(model_mode: str, request_speed: str) -> int:
    if request_speed == "relaxed":
        return 5600
    if request_speed == "priority":
        return 8192 if model_mode == "quality" else 7000
    return 7600 if model_mode == "quality" else 6200


def map_claude_http_error(exc: httpx.HTTPStatusError) -> RuntimeError:
    status_code = exc.response.status_code
    if status_code == HTTPStatus.TOO_MANY_REQUESTS:
        return RuntimeError("Claude API 사용량이 잠시 초과되었습니다. 잠시 후 다시 시도하거나 다른 Claude API 키를 사용해 주세요.")
    if status_code == HTTPStatus.UNAUTHORIZED:
        return RuntimeError("Claude API 키가 유효하지 않습니다. 키를 다시 확인해 주세요.")
    if status_code == HTTPStatus.FORBIDDEN:
        return RuntimeError("Claude API 접근 권한이 없습니다. 현재 키의 사용 권한과 프로젝트 설정을 확인해 주세요.")
    return RuntimeError(f"Claude API 호출에 실패했습니다. 상태 코드: {status_code}")
