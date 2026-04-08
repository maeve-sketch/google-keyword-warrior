import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import FilterPanel from "../components/FilterPanel";
import { getKeywordPriorityScore, getKeywordSegment, isCompetitorClinicKeyword, translateKeywordToKorean } from "../lib/keywordInsights";
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

export default function KeywordFetchPage() {
  const {
    keywords,
    isLoading,
    isRefreshing,
    error,
    refresh,
    language,
    setLanguage,
    dateRange,
    setDateRange,
    minSearchVolume,
    setMinSearchVolume,
    searchConsoleMinImpressions,
    setSearchConsoleMinImpressions,
    adsMinClicks,
    setAdsMinClicks,
    adsMinSpend,
    setAdsMinSpend,
    plannerSeedText,
    setPlannerSeedText,
    fetchFeedback,
    lastFetchedAt,
    lastInsertedCount,
  } = useKeywords();
  const [sourceView, setSourceView] = useState<"all" | "google_ads" | "keyword_planner" | "search_console">("all");
  const [showGuide, setShowGuide] = useState(false);
  const [excludeCompetitorClinics, setExcludeCompetitorClinics] = useState(true);

  const ads = keywords.filter((item) => item.source === "google_ads").length;
  const planner = keywords.filter((item) => item.source === "keyword_planner").length;
  const consoleCount = keywords.filter((item) => item.source === "search_console").length;
  const visibleKeywords = (sourceView === "all" ? keywords : keywords.filter((item) => item.source === sourceView)).filter((item) =>
    excludeCompetitorClinics ? !isCompetitorClinicKeyword(item.keyword) : true,
  );
  const topKeywords = [...visibleKeywords]
    .sort((a, b) => getKeywordPriorityScore(b) - getKeywordPriorityScore(a))
    .slice(0, 6);
  return (
    <main style={pageStyle}>
      <section style={sectionStyle}>
        <header style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#e11d48" }}>1단계 · 키워드 수집</div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.04 }}>키워드 워리어</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 16 }}>
            Google Ads, Keyword Planner, Search Console에서 이번 주 검토할 키워드를 먼저 수집합니다.
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <StatCard label="전체 키워드" value={keywords.length} />
          <StatCard label="Google Ads" value={ads} />
          <StatCard label="Keyword Planner" value={planner} />
          <StatCard label="Search Console" value={consoleCount} />
        </section>

        <FilterPanel
          onRefresh={refresh}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          language={language}
          onLanguageChange={setLanguage}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          minSearchVolume={minSearchVolume}
          onMinSearchVolumeChange={setMinSearchVolume}
          searchConsoleMinImpressions={searchConsoleMinImpressions}
          onSearchConsoleMinImpressionsChange={setSearchConsoleMinImpressions}
          adsMinClicks={adsMinClicks}
          onAdsMinClicksChange={setAdsMinClicks}
          adsMinSpend={adsMinSpend}
          onAdsMinSpendChange={setAdsMinSpend}
          plannerSeedText={plannerSeedText}
          onPlannerSeedTextChange={setPlannerSeedText}
          sourceView={sourceView}
          onSourceViewChange={setSourceView}
          fetchFeedback={fetchFeedback}
          lastFetchedAt={lastFetchedAt}
          lastInsertedCount={lastInsertedCount}
        />

        <section style={panelStyle}>
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
          <div style={{ color: "#64748b", fontSize: 13 }}>
            병원명 자체를 찾는 검색어는 원고 생성 효율이 낮아질 수 있어, 세예 외 타 병원명 + 의원/클리닉 조합을 기본적으로 숨깁니다.
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#7c3aed" }}>수집 기준 가이드</div>
              <h3 style={{ margin: "6px 0 4px", fontSize: 24 }}>현재 어떤 기준으로 걸러지는지</h3>
              <p style={{ margin: 0, color: "#64748b" }}>
                PRD에서 정한 수집 로직을 표로 바로 확인할 수 있습니다.
              </p>
            </div>
            <button type="button" onClick={() => setShowGuide((prev) => !prev)} style={ghostButtonStyle}>
              {showGuide ? "가이드 접기" : "가이드 펼치기"}
            </button>
          </div>

          {showGuide ? (
            <div style={{ display: "grid", gap: 18 }}>
              <div style={{ overflowX: "auto" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>데이터 소스별 전략적 가중치 (GKP 50% · GSC 30% · Ads 20%)</div>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 18, overflow: "hidden" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#334155", textAlign: "left" }}>
                      <th style={thStyle}>소스</th>
                      <th style={thStyle}>가중치</th>
                      <th style={thStyle}>역할</th>
                      <th style={thStyle}>핵심 필터링 로직</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={tdStyle}>Keyword Planner (GKP)</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#7c3aed" }}>50% · 공격</td>
                      <td style={tdStyle}>시장 기회 발굴</td>
                      <td style={tdStyle}>입찰가(CPC) 상위 20% 키워드에 가중치 1.5배. 검색량 10~500 사이 고관여 롱테일 집중. 경쟁도 HIGH 포함.</td>
                    </tr>
                    <tr>
                      <td style={tdStyle}>Search Console (GSC)</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#2563eb" }}>30% · 보완</td>
                      <td style={tdStyle}>점유 기회 파악</td>
                      <td style={tdStyle}>노출수 급증(전주 대비 +20%)에 가중치 부여. 순위 11~30위 키워드는 '리라이팅 우선 후보'로 자동 분류.</td>
                    </tr>
                    <tr>
                      <td style={tdStyle}>Google Ads</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#e11d48" }}>20% · 방어</td>
                      <td style={tdStyle}>효율 검증</td>
                      <td style={tdStyle}>전환 발생 키워드는 Hero 콘텐츠로 고정. 이미 점유 중이면 신규 생성 대신 '랜딩 페이지 최적화'로 분류.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ overflowX: "auto" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>콘텐츠 인텐트 분류 (Hero / Hub / Hygiene)</div>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 18, overflow: "hidden" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#334155", textAlign: "left" }}>
                      <th style={thStyle}>전략 유형</th>
                      <th style={thStyle}>타겟 인텐트</th>
                      <th style={thStyle}>프롬프트 반영</th>
                      <th style={thStyle}>목표 비율</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: "#fff7ed" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#c2410c" }}>Hero (메인)</td>
                      <td style={tdStyle}>고경쟁 / 고전환 (가격, 예약, 이벤트)</td>
                      <td style={tdStyle}>강력한 CTA 3회, 가격·위치·상담 연결 구체 제시</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>20%</td>
                    </tr>
                    <tr style={{ background: "#eff6ff" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#1d4ed8" }}>Hub (중간)</td>
                      <td style={tdStyle}>중경쟁 / 비교형 (비교, 차이, 추천)</td>
                      <td style={tdStyle}>객관적 비교표, 시술별 장단점·유지기간·통증 데이터 삽입</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>30%</td>
                    </tr>
                    <tr style={{ background: "#ecfdf5" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#047857" }}>Hygiene (기초)</td>
                      <td style={tdStyle}>저경쟁 / 정보형 (원리, 후기, 부작용, FAQ)</td>
                      <td style={tdStyle}>E-E-A-T 강화, 원리·관리법·FAQ 5문 이상, CTA는 문말 1회만</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>50%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ overflowX: "auto" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>시드 키워드 자동 확장 & 신규 기회 감지</div>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 18, overflow: "hidden" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#334155", textAlign: "left" }}>
                      <th style={thStyle}>기능</th>
                      <th style={thStyle}>동작 방식</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>시드 키워드 강제 주입</td>
                      <td style={tdStyle}>관리자가 설정한 [국가 x 시술명 x 지역] 조합을 GKP API에 자동 조회하여 시장 전체의 검색량 추이를 수집합니다. (스케줄러 설정에서 관리)</td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>신규 기회 감지</td>
                      <td style={tdStyle}>GKP에서는 검색량이 잡히지만 자사 GSC에는 아직 없는 키워드를 '🆕 신규 기회'로 자동 표시합니다.</td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>리라이팅 후보</td>
                      <td style={tdStyle}>GSC 순위 11~30위 키워드는 '✏️ 리라이팅 후보'로 플래그됩니다. 신규 원고보다 기존 글 보강이 효율적입니다.</td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>Hero 고정</td>
                      <td style={tdStyle}>Ads에서 실제 전환이 발생한 키워드는 '🔒 Hero 고정'으로 잠깁니다. 최우선 콘텐츠 대상입니다.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ padding: "14px 18px", borderRadius: 16, background: "#f0f9ff", border: "1px solid #bae6fd", fontSize: 13, color: "#0c4a6e", lineHeight: 1.6 }}>
                <strong>전체 워크플로우:</strong> 키워드 수집 → <strong>갭 분석</strong>(수요 vs 공급 대조) → 키워드 선정 → 인텐트 선택(Hero/Hub/Hygiene) → 원고 생성 → 대시보드 반영
              </div>
            </div>
          ) : null}
        </section>

        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#7c3aed" }}>수집 결과 미리보기</div>
              <h3 style={{ margin: "6px 0 4px", fontSize: 24 }}>지금 바로 검토할 만한 후보</h3>
              <p style={{ margin: 0, color: "#64748b" }}>
                현재 보기: {sourceView === "all" ? "전체 보기" : sourceView === "google_ads" ? "Google Ads만" : sourceView === "keyword_planner" ? "Keyword Planner만" : "Search Console만"} · 먼저 원하는 언어 기준으로 Google Ads, Keyword Planner, Search Console 데이터를 가져오고, 그 뒤 소스별로 정리해 확인합니다.
              </p>
            </div>
            <Link to="/workflow/select" style={ctaLinkStyle}>
              2단계 키워드 선정으로 이동
            </Link>
          </div>

          {error ? <div style={errorStyle}>{error}</div> : null}

          <div style={{ display: "grid", gap: 10 }}>
            {topKeywords.map((item, index) => (
              <div key={item.id} style={previewRowStyle}>
                <div style={{ display: "grid", gap: 4 }}>
                  <strong>{item.keyword}</strong>
                  <span style={{ color: "#64748b", fontSize: 13 }}>한글 해석: {translateKeywordToKorean(item.keyword)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ color: "#0f172a", fontSize: 13, fontWeight: 800 }}>#{index + 1}</span>
                  <Badge text={item.source === "google_ads" ? "Google Ads" : item.source === "keyword_planner" ? "Keyword Planner" : "Search Console"} />
                  <Badge text={getKeywordSegment(item)} tone="soft" />
                  <span style={{ color: "#475569", fontSize: 13, fontWeight: 700 }}>추천 점수 {Math.round(getKeywordPriorityScore(item))}</span>
                </div>
              </div>
            ))}
            {topKeywords.length === 0 ? <div style={{ color: "#64748b" }}>아직 수집된 키워드가 없습니다. 위에서 먼저 불러와 주세요.</div> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ ...panelStyle, padding: 18 }}>
      <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>{label}</p>
      <strong style={{ fontSize: 32 }}>{value}</strong>
    </div>
  );
}

function Badge({ text, tone = "solid" }: { text: string; tone?: "solid" | "soft" }) {
  return (
    <span
      style={{
        borderRadius: 999,
        padding: "6px 10px",
        background: tone === "solid" ? "#fff1f2" : "#eff6ff",
        color: tone === "solid" ? "#e11d48" : "#2563eb",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {text}
    </span>
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

const previewRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
  padding: "14px 16px",
  borderRadius: 18,
  background: "#fff",
  border: "1px solid #eef2f7",
};

const ctaLinkStyle: CSSProperties = {
  borderRadius: 999,
  padding: "14px 20px",
  background: "linear-gradient(135deg, #833ab4, #fd1d1d 55%, #fcb045)",
  color: "#fff",
  fontWeight: 800,
  textDecoration: "none",
  boxShadow: "0 16px 40px rgba(253, 29, 29, 0.22)",
};

const ghostButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "12px 18px",
  background: "#fff",
  color: "#475569",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "inset 0 0 0 1px #e2e8f0",
};

const thStyle: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
  fontWeight: 800,
};

const tdStyle: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 14,
  color: "#334155",
  verticalAlign: "top",
  lineHeight: 1.5,
};

const errorStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  fontSize: 14,
};
