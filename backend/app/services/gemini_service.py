from __future__ import annotations

import asyncio
import json
import logging
from http import HTTPStatus
from typing import AsyncIterator, List

import httpx

logger = logging.getLogger(__name__)

from app.services.llm_prompt import build_blog_prompt, build_continuation_prompt, is_draft_complete

PRIMARY_GEMINI_MODEL = "gemini-2.5-pro"
FALLBACK_GEMINI_MODEL = "gemini-2.5-flash"
STABLE_GEMINI_MODEL = "gemini-2.0-flash"


async def stream_blog_draft(
    gemini_api_key: str,
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
    model_sequence = resolve_model_sequence(model_mode, request_speed)
    async with httpx.AsyncClient(timeout=120.0) as client:
        accumulated = ""
        current_prompt = prompt
        for attempt in range(5):
            payload = build_gemini_payload(current_prompt, model_mode, request_speed, continuation=attempt > 0)
            text, used_error = await _run_model_sequence(client, model_sequence, gemini_api_key, payload, request_speed)
            accumulated += text
            if text:
                yield text
            if is_draft_complete(accumulated):
                return
            if used_error is not None:
                raise _map_gemini_http_error(used_error) from used_error
            current_prompt = build_continuation_prompt(accumulated)

        if accumulated:
            yield "\n\n[EDITOR_NOTE: 자동 이어쓰기를 최대치까지 수행했습니다. FAQ/마무리/메타가 비었는지 마지막만 확인해 주세요.]"
            return


_RETRYABLE_STATUSES = {
    HTTPStatus.TOO_MANY_REQUESTS,       # 429
    HTTPStatus.SERVICE_UNAVAILABLE,      # 503
    HTTPStatus.BAD_GATEWAY,             # 502
    HTTPStatus.GATEWAY_TIMEOUT,         # 504
}


async def _run_model_sequence(
    client: httpx.AsyncClient,
    model_sequence: List[str],
    gemini_api_key: str,
    payload: dict,
    request_speed: str,
) -> tuple[str, httpx.HTTPStatusError | None]:
    last_error: httpx.HTTPStatusError | None = None
    combined = ""
    for model_name in model_sequence:
        for retry in range(3):
            try:
                if request_speed == "relaxed":
                    await asyncio.sleep(1.2)
                elif request_speed == "standard":
                    await asyncio.sleep(0.35)
                if retry > 0:
                    await asyncio.sleep(2 ** retry)  # exponential backoff: 2s, 4s
                async for chunk in _stream_with_model(client, model_name, gemini_api_key, payload):
                    combined += chunk
                return combined, None
            except httpx.HTTPStatusError as exc:
                last_error = exc
                logger.error(
                    "Gemini retry: model=%s status=%s attempt=%d/3",
                    model_name, exc.response.status_code, retry + 1,
                )
                if exc.response.status_code in _RETRYABLE_STATUSES:
                    continue  # retry same model
                raise _map_gemini_http_error(exc) from exc
        logger.warning("All retries exhausted for model=%s, trying next", model_name)
    logger.error("All models failed. Last error: %s", last_error)
    return combined, last_error


def resolve_model_sequence(model_mode: str, request_speed: str) -> List[str]:
    # Always append gemini-2.0-flash as last-resort stable fallback
    if request_speed == "priority":
        if model_mode == "quality":
            return [PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, STABLE_GEMINI_MODEL]
        return [FALLBACK_GEMINI_MODEL, PRIMARY_GEMINI_MODEL, STABLE_GEMINI_MODEL]
    if request_speed == "standard":
        if model_mode == "quality":
            return [PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, STABLE_GEMINI_MODEL]
        return [FALLBACK_GEMINI_MODEL, PRIMARY_GEMINI_MODEL, STABLE_GEMINI_MODEL]
    return [FALLBACK_GEMINI_MODEL, PRIMARY_GEMINI_MODEL, STABLE_GEMINI_MODEL]


def build_gemini_payload(prompt: str, model_mode: str, request_speed: str, continuation: bool = False) -> dict:
    max_tokens = 6200
    if request_speed == "relaxed":
        max_tokens = 5600
    elif request_speed == "priority":
        max_tokens = 8192 if model_mode == "quality" else 7000
    elif model_mode == "quality":
        max_tokens = 7600

    return {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.5 if continuation else 0.55,
            "maxOutputTokens": max_tokens,
            "candidateCount": 1,
        },
    }


async def _stream_with_model(
    client: httpx.AsyncClient,
    model_name: str,
    gemini_api_key: str,
    payload: dict,
) -> AsyncIterator[str]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?alt=sse&key={gemini_api_key}"
    async with client.stream("POST", url, json=payload) as response:
        if response.status_code >= 400:
            body = (await response.aread()).decode(errors="replace")[:500]
            logger.error("Gemini HTTP %s from %s: %s", response.status_code, model_name, body)
            response.raise_for_status()
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            data = line.replace("data: ", "", 1).strip()
            if not data or data == "[DONE]":
                continue
            try:
                parsed = json.loads(data)
                candidates = parsed.get("candidates", [])
                if not candidates:
                    continue
                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    continue
                text = parts[0].get("text", "")
                if text:
                    yield text
            except json.JSONDecodeError:
                continue


def _map_gemini_http_error(exc: httpx.HTTPStatusError) -> RuntimeError:
    status_code = exc.response.status_code
    if status_code == HTTPStatus.TOO_MANY_REQUESTS:
        return RuntimeError("Gemini API 사용량이 잠시 초과되었습니다. 잠시 후 다시 시도하거나 다른 Gemini API 키를 사용해 주세요.")
    if status_code in (HTTPStatus.SERVICE_UNAVAILABLE, HTTPStatus.BAD_GATEWAY, HTTPStatus.GATEWAY_TIMEOUT):
        return RuntimeError(f"Gemini 서버가 일시적으로 과부하 상태입니다 (HTTP {status_code}). 1~2분 후 다시 시도해 주세요.")
    if status_code == HTTPStatus.UNAUTHORIZED:
        return RuntimeError("Gemini API 키가 유효하지 않습니다. 키를 다시 확인해 주세요.")
    if status_code == HTTPStatus.FORBIDDEN:
        return RuntimeError("Gemini API 접근 권한이 없습니다. 현재 키의 사용 권한과 프로젝트 설정을 확인해 주세요.")
    return RuntimeError(f"Gemini API 호출에 실패했습니다. 상태 코드: {status_code}")
