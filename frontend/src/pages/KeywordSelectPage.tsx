import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import KeywordTable from "../components/KeywordTable";
import { buildKeywordScoreContext, getKeywordPriorityScore, getKeywordSegment, isCompetitorClinicKeyword } from "../lib/keywordInsights";
import { loadSelectedKeywordIds, saveSelectedKeywordIds } from "../lib/workflowState";
import { useKeywords } from "../hooks/useKeywords";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(252,176,69,0.18), transparent 22%), radial-gradient(circle at top right, rgba(131,58,180,0.14), transparent 24%), linear-gradient(180deg, #fff7f3 0%, #fff 32%, #fff5f7 100%)",
};

const sectionStyle: CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: "24px 24px 48px",
  display: "grid",
  gap: 18,
};

const sortSelectStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  background: "#fff",
  padding: "10px 12px",
  fontSize: 14,
  color: "#334155",
};

export default function KeywordSelectPage() {
  const navigate = useNavigate();
  const { keywords, language, setLanguage } = useKeywords();
  const [sourceView, setSourceView] = useState<"all" | "google_ads" | "keyword_planner" | "search_console">("all");
  const [sortKey, setSortKey] = useState<"priority" | "keyword" | "volume" | "rank" | "cpc" | "clicks" | "ctr">("priority");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [commercialWeight, setCommercialWeight] = useState(65);
  const [selectedIds, setSelectedIdsRaw] = useState<string[]>(() => loadSelectedKeywordIds());
  const [excludeCompetitorClinics, setExcludeCompetitorClinics] = useState(true);

  // Wrap setSelectedIds to always save synchronously
  const setSelectedIds = (updater: string[] | ((prev: string[]) => string[])) => {
    setSelectedIdsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveSelectedKeywordIds(next);
      return next;
    });
  };

  // Filter out stale IDs that no longer exist in the keyword pool
  useEffect(() => {
    if (keywords.length === 0) return;
    const validIds = new Set(keywords.map((kw) => kw.id));
    setSelectedIds((prev: string[]) => prev.filter((id) => validIds.has(id)));
  }, [keywords]);

  useEffect(() => {
    const preferredSortOrder: Record<typeof sortKey, "asc" | "desc"> = {
      priority: "desc",
      volume: "desc",
      clicks: "desc",
      ctr: "desc",
      cpc: "asc",
      rank: "asc",
      keyword: "asc",
    };
    setSortOrder(preferredSortOrder[sortKey]);
  }, [sortKey]);

  const visibleKeywords = useMemo(() => {
    const filtered = (sourceView === "all" ? keywords : keywords.filter((item) => item.source === sourceView)).filter((item) =>
      excludeCompetitorClinics ? !isCompetitorClinicKeyword(item.keyword) : true,
    );
    const scoreContext = buildKeywordScoreContext(filtered);
    return [...filtered].sort((a, b) => {
      const weightedPriority = (item: typeof a) => {
        const segment = getKeywordSegment(item);
        const commercialBoost = segment === "Hero" ? commercialWeight : segment === "Hub" ? 50 : 100 - commercialWeight;
        return getKeywordPriorityScore(item, scoreContext) + commercialBoost / 10;
      };
      const aValue =
        sortKey === "priority"
          ? weightedPriority(a)
          : sortKey === "keyword"
            ? a.keyword.toLowerCase()
            : sortKey === "volume"
              ? Number(a.source === "search_console" ? a.impressions ?? a.search_volume ?? 0 : a.search_volume ?? 0)
              : sortKey === "rank"
                ? Number(a.source === "search_console" ? a.position ?? 999 : a.competition_index ?? 0)
                : sortKey === "cpc"
                  ? Number(a.avg_cpc ?? 0)
                  : sortKey === "clicks"
                    ? Number(a.source === "search_console" ? a.clicks ?? 0 : a.conversions ?? 0)
                    : Number(a.source === "search_console" ? a.ctr ?? a.conversion_rate ?? 0 : a.conversion_rate ?? 0);
      const bValue =
        sortKey === "priority"
          ? weightedPriority(b)
          : sortKey === "keyword"
            ? b.keyword.toLowerCase()
            : sortKey === "volume"
              ? Number(b.source === "search_console" ? b.impressions ?? b.search_volume ?? 0 : b.search_volume ?? 0)
              : sortKey === "rank"
                ? Number(b.source === "search_console" ? b.position ?? 999 : b.competition_index ?? 0)
                : sortKey === "cpc"
                  ? Number(b.avg_cpc ?? 0)
                  : sortKey === "clicks"
                    ? Number(b.source === "search_console" ? b.clicks ?? 0 : b.conversions ?? 0)
                    : Number(b.source === "search_console" ? b.ctr ?? b.conversion_rate ?? 0 : b.conversion_rate ?? 0);
      const comparison =
        typeof aValue === "string" && typeof bValue === "string"
          ? aValue.localeCompare(bValue)
          : Number(aValue) - Number(bValue);
      return sortOrder === "asc" ? comparison : comparison * -1;
    });
  }, [commercialWeight, excludeCompetitorClinics, keywords, sourceView, sortKey, sortOrder]);

  return (
    <main style={pageStyle}>
      <section style={sectionStyle}>
        <header style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#e11d48" }}>2단계 · 키워드 선정</div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.04 }}>이번 주에 쓸 키워드 고르기</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 16 }}>
            PRD 기준으로 Hero, Hub, Hygiene 추천을 보면서 이번 배치 키워드를 선택합니다.
          </p>
        </header>

        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <strong style={{ fontSize: 20 }}>선정 필터</strong>
              <span style={{ color: "#64748b", fontSize: 14 }}>수집된 키워드를 언어·소스·우선순위 기준으로 정렬해서 봅니다.</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to="/workflow/fetch" style={ghostLinkStyle}>수집 단계로 돌아가기</Link>
              <button type="button" onClick={() => navigate("/workflow/draft")} style={ctaButtonStyle} disabled={!selectedIds.length}>
                선택 키워드로 원고 작성 단계 이동
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={sortSelectStyle}>
              <option value="ja">일본어</option>
              <option value="ko">한국어</option>
              <option value="en">영어</option>
              <option value="zh-TW">대만어 (繁體中文)</option>
            </select>
            <select value={sourceView} onChange={(e) => setSourceView(e.target.value as typeof sourceView)} style={sortSelectStyle}>
              <option value="all">전체 보기</option>
              <option value="google_ads">Google Ads만</option>
              <option value="keyword_planner">Keyword Planner만</option>
              <option value="search_console">Search Console만</option>
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} style={sortSelectStyle}>
              <option value="priority">추천 우선순위</option>
              <option value="volume">노출/검색량</option>
              <option value="clicks">클릭/전환</option>
              <option value="ctr">CTR</option>
              <option value="cpc">CPC</option>
              <option value="rank">순위/경쟁도</option>
              <option value="keyword">키워드명</option>
            </select>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)} style={sortSelectStyle}>
              <option value="desc">
                {sortKey === "cpc" || sortKey === "rank" ? "높은 값 우선" : "높은 값 우선"}
              </option>
              <option value="asc">
                {sortKey === "cpc" || sortKey === "rank" ? "낮은 값 우선" : "낮은 값 우선"}
              </option>
            </select>
          </div>

          <label style={{ display: "grid", gap: 8, color: "#334155", fontWeight: 700 }}>
            상업성 vs 정보성 가중치
            <input type="range" min={0} max={100} value={commercialWeight} onChange={(e) => setCommercialWeight(Number(e.target.value))} />
            <span style={{ color: "#64748b", fontSize: 13 }}>
              현재 {commercialWeight >= 50 ? `상업성 ${commercialWeight}%` : `정보성 ${100 - commercialWeight}%`} 쪽에 더 무게를 둡니다.
            </span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#334155",
              fontWeight: 700,
            }}
          >
            <input
              type="checkbox"
              checked={excludeCompetitorClinics}
              onChange={(e) => setExcludeCompetitorClinics(e.target.checked)}
            />
            경쟁사 고유명사 + 클리닉 조합 키워드 제외
          </label>

          <div style={{ padding: "14px 16px", borderRadius: 16, background: "#f8fafc", color: "#475569", fontSize: 14 }}>
            체크박스로 고르는 것은 <strong>이번 주 원고 생성 대상</strong>입니다. Hero는 전환형, Hub는 비교형, Hygiene은 정보형으로 추천합니다.
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            현재 정렬 기준이 <strong>{sortKey === "cpc" ? "CPC" : sortKey === "rank" ? "순위/경쟁도" : sortKey === "priority" ? "추천 우선순위" : sortKey === "volume" ? "노출/검색량" : sortKey === "clicks" ? "클릭/전환" : sortKey === "ctr" ? "CTR" : "키워드명"}</strong> 이라서
            {" "}
            기본 정렬은 <strong>{sortOrder === "asc" ? "낮은 값 우선" : "높은 값 우선"}</strong>으로 맞춰집니다.
          </div>
        </section>

        <section style={{ ...panelStyle, padding: 0, overflow: "hidden" }}>
          <KeywordTable keywords={visibleKeywords} selectedIds={selectedIds} onSelect={setSelectedIds} />
        </section>
      </section>
    </main>
  );
}

const panelStyle: CSSProperties = {
  background: "rgba(255,255,255,0.84)",
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.78)",
  boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
  padding: 22,
  display: "grid",
  gap: 16,
  backdropFilter: "blur(18px)",
};

const ctaButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "12px 18px",
  background: "linear-gradient(135deg, #833ab4, #fd1d1d 55%, #fcb045)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 16px 40px rgba(253, 29, 29, 0.22)",
};

const ghostLinkStyle: CSSProperties = {
  borderRadius: 999,
  padding: "12px 18px",
  background: "#fff",
  color: "#475569",
  fontWeight: 800,
  textDecoration: "none",
  boxShadow: "inset 0 0 0 1px #e2e8f0",
};
