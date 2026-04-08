import type { Keyword } from "../types";
import { useMemo } from "react";
import { buildKeywordScoreContext, getKeywordPriorityScore, getKeywordRecommendation, getKeywordSegment, translateKeywordToKorean } from "../lib/keywordInsights";

type KeywordTableProps = {
  keywords: Keyword[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
};

export default function KeywordTable({ keywords, selectedIds, onSelect }: KeywordTableProps) {
  const scoreContext = useMemo(() => buildKeywordScoreContext(keywords), [keywords]);

  const toggle = (keywordId: string) => {
    const id = keywordId;
    const next = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    onSelect(next);
  };

  return (
    <div style={{ display: "grid", gap: 8, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 22 }}>키워드 워리어</h3>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>체크박스로 이번 배치에 넣을 키워드만 고르면 됩니다.</p>
        </div>
        <div style={{ borderRadius: 999, background: "#fff1f2", color: "#e11d48", padding: "10px 14px", fontWeight: 800 }}>
          선택됨 {selectedIds.length}개
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "48px minmax(260px, 1.8fr) repeat(5, minmax(76px, 0.6fr))",
            gap: 12,
            padding: "0 12px",
            color: "#94a3b8",
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          <span />
          <span>키워드</span>
          <span>노출/검색량</span>
          <span>경쟁/순위</span>
          <span>CPC</span>
          <span>클릭/전환</span>
          <span>CTR</span>
        </div>
        {keywords.map((keyword, index) => {
          const segment = getKeywordSegment(keyword);
          const recommendation = getKeywordRecommendation(keyword);
          const translated = translateKeywordToKorean(keyword.keyword);
          const priorityScore = Math.round(getKeywordPriorityScore(keyword, scoreContext));
          return (
            <div
              key={keyword.id}
              style={{
                display: "grid",
                gridTemplateColumns: "48px minmax(260px, 1.8fr) repeat(5, minmax(76px, 0.6fr))",
                gap: 12,
                alignItems: "center",
                padding: "14px 12px",
                borderRadius: 18,
                background: "#fff",
                border: selectedIds.includes(keyword.id) ? "1px solid rgba(253, 29, 29, 0.35)" : "1px solid #eef2f7",
                boxShadow: selectedIds.includes(keyword.id) ? "0 12px 24px rgba(253, 29, 29, 0.1)" : "0 6px 18px rgba(15, 23, 42, 0.04)",
              }}
            >
              <input type="checkbox" checked={selectedIds.includes(keyword.id)} onChange={() => toggle(keyword.id)} />
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 15, lineHeight: 1.25 }}>{keyword.keyword}</strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>한글 해석: {translated}</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 800 }}>#{index + 1}</span>
                  <span style={{ borderRadius: 999, padding: "6px 10px", background: keyword.source === "google_ads" ? "#fee2e2" : "#ede9fe", color: keyword.source === "google_ads" ? "#b91c1c" : "#6d28d9", fontWeight: 700, fontSize: 12 }}>
                    {keyword.source === "google_ads" ? "Google Ads" : keyword.source === "keyword_planner" ? "Keyword Planner" : "Search Console"}
                  </span>
                  <span
                    style={{
                      borderRadius: 999,
                      padding: "6px 10px",
                      background: segment === "Hero" ? "#fff7ed" : segment === "Hub" ? "#eff6ff" : "#ecfdf5",
                      color: segment === "Hero" ? "#c2410c" : segment === "Hub" ? "#1d4ed8" : "#047857",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {segment}
                  </span>
                  {keyword.opportunity_flag ? (
                    <span style={{
                      borderRadius: 999,
                      padding: "6px 10px",
                      background: keyword.opportunity_flag === "new_opportunity" ? "#fef3c7" : keyword.opportunity_flag === "hero_locked" ? "#fee2e2" : "#e0e7ff",
                      color: keyword.opportunity_flag === "new_opportunity" ? "#92400e" : keyword.opportunity_flag === "hero_locked" ? "#b91c1c" : "#3730a3",
                      fontWeight: 700,
                      fontSize: 11,
                    }}>
                      {keyword.opportunity_flag === "new_opportunity" ? "🆕 신규 기회" : keyword.opportunity_flag === "hero_locked" ? "🔒 Hero 고정" : "✏️ 리라이팅"}
                    </span>
                  ) : null}
                  <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>추천 점수 {priorityScore}</span>
                </div>
                <span style={{ fontSize: 12, color: "#64748b" }}>{recommendation}</span>
              </div>
              <Metric label={keyword.source === "search_console" ? "노출수" : "검색량"} value={keyword.source === "search_console" ? keyword.impressions ?? keyword.search_volume ?? "-" : keyword.search_volume ?? "-"} />
              <Metric label={keyword.source === "search_console" ? "평균순위" : "경쟁도"} value={keyword.source === "search_console" ? keyword.position ?? "-" : keyword.competition_level ?? "-"} />
              <Metric label="CPC" value={keyword.avg_cpc ?? "-"} />
              <Metric label={keyword.source === "search_console" ? "클릭수" : "전환수"} value={keyword.source === "search_console" ? keyword.clicks ?? 0 : keyword.conversions ?? 0} />
              <Metric label={keyword.source === "search_console" ? "CTR" : "CTR/전환율"} value={`${keyword.source === "search_console" ? keyword.ctr ?? keyword.conversion_rate ?? 0 : keyword.conversion_rate ?? 0}%`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{label}</span>
      <strong style={{ fontSize: 14, color: "#0f172a" }}>{value}</strong>
    </div>
  );
}
