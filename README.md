# Google Keyword Warrior

Google Ads 성과 데이터와 Keyword Planner를 결합해 전환이 검증된 키워드를 수집하고, 필터링하고, 사용자가 입력한 Gemini API 키로 블로그 초안을 생성하는 내부 웹 애플리케이션입니다.

## v1 Architecture

- Frontend: React 18 + Vite + TypeScript
- Backend: FastAPI
- Google Ads auth: server-managed service account credentials
- AI generation: user-pasted Gemini API key per request
- Database: Supabase by default, local JSON fallback for early development

## Why this version

- Google Ads 연동은 이미 Python으로 검증된 로직을 재사용할 수 있습니다.
- 내부 툴이므로 Google OAuth보다 서버 관리형 Ads 인증이 더 단순하고 안정적입니다.
- 원고 생성은 각 작업자가 자신의 Gemini API 키를 붙여넣는 방식으로 운영합니다.

## Folder layout

```text
google-keyword-warrior/
├── frontend/
├── backend/
└── .env.example
```

## Quick start

### Backend

```bash
cd "/Users/user/Documents/New project/google-keyword-warrior/backend"
python3 -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 3001
```

### Frontend

```bash
cd "/Users/user/Documents/New project/google-keyword-warrior/frontend"
npm install
npm run dev
```

## Current implementation scope

- Keyword fetch API scaffold
- Keyword list API scaffold
- Gemini draft generation SSE scaffold
- React dashboard/editor/settings shell
- Supabase schema and environment templates

## Reused assets

- Google Ads keyword metrics logic from `/Users/user/Documents/New project/jp-content-strategy`
- Product direction from the new PRD
