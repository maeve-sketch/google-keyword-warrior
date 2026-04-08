import type { BlogPost, ContentInventoryItem, Keyword, SeedExpansionConfig } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:3001";

export async function fetchKeywords(params: Record<string, string | number | undefined> = {}): Promise<{ keywords: Keyword[]; total: number }> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const response = await fetch(`${API_BASE}/api/keywords?${search.toString()}`);
  if (!response.ok) throw new Error("키워드 로드 실패");
  return response.json();
}

export async function runKeywordFetch(
  body: {
    dateRange?: string;
    language?: string;
    limit?: number;
    minSearchVolume?: number;
    searchConsoleMinImpressions?: number;
    adsMinClicks?: number;
    adsMinSpend?: number;
    includeHighCompetition?: boolean;
    plannerSeeds?: string[];
  } = {},
) {
  const response = await fetch(`${API_BASE}/api/keywords/fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRange: body.dateRange ?? "30d",
      language: body.language ?? "ja",
      limit: body.limit ?? 50,
      minSearchVolume: body.minSearchVolume ?? 10,
      searchConsoleMinImpressions: body.searchConsoleMinImpressions ?? 100,
      adsMinClicks: body.adsMinClicks ?? 10,
      adsMinSpend: body.adsMinSpend ?? 0,
      includeHighCompetition: body.includeHighCompetition ?? true,
      plannerSeeds: body.plannerSeeds ?? [],
    }),
  });
  if (!response.ok) throw new Error("키워드 수집 실패");
  return response.json();
}

export async function updateKeywordStatus(keywordId: string, status: string) {
  const response = await fetch(`${API_BASE}/api/keywords/${keywordId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error("상태 변경 실패");
  return response.json();
}

export async function fetchBlogPosts(): Promise<{ posts: BlogPost[]; total: number }> {
  const response = await fetch(`${API_BASE}/api/blog`);
  if (!response.ok) throw new Error("블로그 목록 로드 실패");
  return response.json();
}

export async function fetchBlogPost(blogId: string): Promise<BlogPost> {
  const response = await fetch(`${API_BASE}/api/blog/${blogId}`);
  if (!response.ok) throw new Error("블로그 상세 로드 실패");
  return response.json();
}

export async function updateBlogPost(
  blogId: string,
  patch: { title?: string; content?: string; status?: string },
): Promise<{ ok: boolean; post: BlogPost }> {
  const response = await fetch(`${API_BASE}/api/blog/${blogId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error("블로그 저장 실패");
  return response.json();
}

// --- Seed Expansion Configs ---

export async function fetchSeedConfigs(): Promise<{ configs: SeedExpansionConfig[]; total: number }> {
  const response = await fetch(`${API_BASE}/api/scheduler/configs`);
  if (!response.ok) throw new Error("시드 설정 로드 실패");
  return response.json();
}

export async function createSeedConfig(body: {
  country: string;
  procedure_name: string;
  region?: string;
  seed_keywords?: string[];
  is_active?: boolean;
}): Promise<{ ok: boolean; config: SeedExpansionConfig }> {
  const response = await fetch(`${API_BASE}/api/scheduler/configs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("시드 설정 생성 실패");
  return response.json();
}

export async function updateSeedConfig(
  configId: string,
  patch: Partial<Pick<SeedExpansionConfig, "country" | "procedure_name" | "region" | "seed_keywords" | "is_active">>,
): Promise<{ ok: boolean; config: SeedExpansionConfig }> {
  const response = await fetch(`${API_BASE}/api/scheduler/configs/${configId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error("시드 설정 수정 실패");
  return response.json();
}

export async function deleteSeedConfig(configId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/api/scheduler/configs/${configId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("시드 설정 삭제 실패");
  return response.json();
}

export async function triggerSeedExpansion(): Promise<{ ok: boolean; expanded: number; new_opportunities: number; warnings: string[] }> {
  const response = await fetch(`${API_BASE}/api/scheduler/run-now`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("시드 확장 실행 실패");
  return response.json();
}

// --- Content Inventory ---

export async function fetchInventory(): Promise<{ items: ContentInventoryItem[]; total: number }> {
  const response = await fetch(`${API_BASE}/api/inventory`);
  if (!response.ok) throw new Error("인벤토리 로드 실패");
  return response.json();
}

export async function syncInventory(): Promise<{ ok: boolean; synced: number }> {
  const response = await fetch(`${API_BASE}/api/inventory/sync`, { method: "POST" });
  if (!response.ok) throw new Error("인벤토리 동기화 실패");
  return response.json();
}

export type GapEntry = {
  keyword: string;
  source: string;
  intent_segment: string;
  demand: number;
  weighted_score: number;
  is_covered: boolean;
  opportunity_flag: string | null;
  gap_severity: number;
};

export async function fetchGapMatrix(): Promise<{ entries: GapEntry[]; total: number }> {
  const response = await fetch(`${API_BASE}/api/inventory/gap-matrix`);
  if (!response.ok) throw new Error("갭 매트릭스 로드 실패");
  return response.json();
}

export type MixRatioData = {
  actual_counts: Record<string, number>;
  actual_pct: Record<string, number>;
  target_pct: Record<string, number>;
  total: number;
  gaps: Record<string, number>;
};

export async function fetchMixRatio(): Promise<MixRatioData> {
  const response = await fetch(`${API_BASE}/api/inventory/mix-ratio`);
  if (!response.ok) throw new Error("믹스 비율 로드 실패");
  return response.json();
}
