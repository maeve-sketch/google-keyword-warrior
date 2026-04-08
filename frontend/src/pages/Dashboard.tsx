import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import FilterPanel from "../components/FilterPanel";
import GenerateButton from "../components/GenerateButton";
import KeywordTable from "../components/KeywordTable";
import { useBlogGenerate } from "../hooks/useBlogGenerate";
import { useKeywords } from "../hooks/useKeywords";

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

export default function Dashboard() {
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
  const { isGenerating, streamedContent, error: generateError, progress, stageLabel, startGenerate } = useBlogGenerate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clinicName, setClinicName] = useState("セイェクリニック");
  const [tone, setTone] = useState("신뢰감 있는 전문 톤");
  const [speaker, setSpeaker] = useState("none");
  const [customInstruction, setCustomInstruction] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [sourceView, setSourceView] = useState<"all" | "google_ads" | "keyword_planner" | "search_console">("all");
  const [sortKey, setSortKey] = useState<"keyword" | "volume" | "rank" | "cpc" | "clicks" | "ctr">("volume");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const visibleKeywords = useMemo(() => {
    const filtered = sourceView === "all" ? keywords : keywords.filter((item) => item.source === sourceView);
    const ranked = [...filtered].sort((a, b) => compareKeywords(a, b, sortKey, sortOrder));
    return ranked;
  }, [keywords, sourceView, sortKey, sortOrder]);

  const stats = useMemo(() => {
    const selected = visibleKeywords.filter((item) => selectedIds.includes(item.id)).length;
    const generated = visibleKeywords.filter((item) => item.status === "generated").length;
    const published = visibleKeywords.filter((item) => item.status === "published").length;
    const ads = keywords.filter((item) => item.source === "google_ads").length;
    const planner = keywords.filter((item) => item.source === "keyword_planner").length;
    const searchConsole = keywords.filter((item) => item.source === "search_console").length;
    return { total: visibleKeywords.length, selected, generated, published, ads, planner, searchConsole };
  }, [keywords, visibleKeywords, selectedIds]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(252,176,69,0.25), transparent 22%), radial-gradient(circle at top right, rgba(131,58,180,0.18), transparent 24%), linear-gradient(180deg, #fff7f3 0%, #fff 30%, #fff5f7 100%)",
      }}
    >
      <section style={sectionStyle}>
        <header style={{ display: "grid", gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.04 }}>Google Keyword Warrior</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 16 }}>
            전환이 실제로 발생한 검색어를 먼저 불러오고, Keyword Planner로 확장한 뒤, 선택한 키워드만 바로 원고 작업 큐로 넘깁니다.
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
          <StatCard label="지금 보는 키워드 수" value={stats.total} accent="linear-gradient(135deg, #fd1d1d, #fcb045)" />
          <StatCard label="이번 배치 선택 수" value={stats.selected} accent="linear-gradient(135deg, #833ab4, #fd1d1d)" />
          <StatCard label="Google Ads 키워드" value={stats.ads} accent="linear-gradient(135deg, #f97316, #fb7185)" />
          <StatCard label="Keyword Planner 키워드" value={stats.planner} accent="linear-gradient(135deg, #8b5cf6, #ec4899)" />
          <StatCard label="Search Console 키워드" value={stats.searchConsole} accent="linear-gradient(135deg, #0ea5e9, #22c55e)" />
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

        <section
          style={{
            padding: 22,
            background: "rgba(255,255,255,0.84)",
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,0.78)",
            display: "grid",
            gap: 14,
            boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9333ea" }}>Writer Studio</div>
              <h3 style={{ margin: "6px 0 4px", fontSize: 24 }}>선택 키워드로 원고 생성</h3>
              <p style={{ margin: 0, color: "#64748b" }}>
                체크박스로 선택한 키워드만 원고 대상이 됩니다. 리스트에서는 원고 대상 선택만 하고, 별도 작업 상태 관리는 우선 제거했습니다.
              </p>
            </div>
            <div style={{ borderRadius: 20, background: "#fff7ed", color: "#c2410c", padding: "10px 14px", fontWeight: 700 }}>
              기본 클리닉명: セイェクリニック
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr", gap: 14 }}>
            <label style={fieldStyle}>
              Gemini API Key
              <input type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              클리닉명
              <input value={clinicName} onChange={(e) => setClinicName(e.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              톤
              <select value={tone} onChange={(e) => setTone(e.target.value)} style={inputStyle}>
                <option value="신뢰감 있는 전문 톤">신뢰감 있는 전문 톤</option>
                <option value="친절하고 상담형 톤">친절하고 상담형 톤</option>
                <option value="객관적이고 비교 중심 톤">객관적이고 비교 중심 톤</option>
                <option value="부드럽고 입문자 친화 톤">부드럽고 입문자 친화 톤</option>
                <option value="고관여 검색자용 전환 톤">고관여 검색자용 전환 톤</option>
              </select>
            </label>
            <label style={fieldStyle}>
              화자 설정
              <select value={speaker} onChange={(e) => setSpeaker(e.target.value)} style={inputStyle}>
                <option value="none">없음</option>
                <option value="doctor">미용의료클리닉 원장</option>
                <option value="director">상담실장</option>
                <option value="columnist">미용칼럼니스트</option>
              </select>
            </label>
          </div>

          <label style={fieldStyle}>
            직접 입력 조정
            <textarea
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
              placeholder="예: 한국에서 미용 시술을 받으러 오는 일본인 독자가 불안해하는 포인트를 먼저 짚고, 상담 동선과 차이점을 조금 더 친절하게 설명해 주세요."
            />
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ color: "#64748b", fontSize: 14 }}>
              현재 보기: <strong>{sourceView === "all" ? "합산 보기" : sourceView === "google_ads" ? "Google Ads" : sourceView === "keyword_planner" ? "Keyword Planner" : "Search Console"}</strong> / 언어:{" "}
              <strong>{language === "ja" ? "일본어" : language === "ko" ? "한국어" : language === "zh-TW" ? "대만어" : "영어"}</strong>
            </div>
            <GenerateButton
              disabled={!selectedIds.length || !geminiApiKey}
              isGenerating={isGenerating}
              onClick={() =>
                void startGenerate({
                  keywordIds: selectedIds,
                  clinicName,
                  tone,
                  speaker,
                  customInstruction,
                  llmProvider: "gemini",
                  apiKey: geminiApiKey,
                  modelMode: "fast",
                  requestSpeed: "relaxed",
                  manualKeyword: "",
                  manualRelatedKeywords: [],
                  intentSegment: "auto",
                })
              }
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <strong style={{ fontSize: 15 }}>원고 생성 진행 상태</strong>
              <span style={{ color: isGenerating ? "#7c3aed" : "#64748b", fontSize: 14, fontWeight: 700 }}>{stageLabel}</span>
            </div>
            <div style={{ height: 12, borderRadius: 999, background: "#ede9fe", overflow: "hidden" }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #833ab4, #fd1d1d 55%, #fcb045)",
                  transition: "width 220ms ease",
                }}
              />
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>{isGenerating ? "요청 전달 → 본문 생성 → 완료 단계로 진행됩니다." : "생성 버튼을 누르면 여기에서 진행 상태가 보입니다."}</div>
            {generateError ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "#fef2f2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  fontSize: 14,
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ display: "block", marginBottom: 4 }}>원고 생성 오류</strong>
                <span>{generateError}</span>
              </div>
            ) : null}
            <div
              style={{
                padding: 16,
                borderRadius: 20,
                background: "linear-gradient(135deg, #1f2937, #111827 56%, #312e81)",
                color: "#f9fafb",
                boxShadow: "0 12px 30px rgba(15, 23, 42, 0.16)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <strong style={{ display: "block", fontSize: 15 }}>생성 중 초안 미리보기</strong>
                  <span style={{ color: "#cbd5e1", fontSize: 13 }}>생성된 원고는 여기에서 바로 이어서 확인할 수 있습니다.</span>
                </div>
                <div style={{ color: "#cbd5e1", fontSize: 13 }}>{streamedContent ? "실시간 반영 중" : "아직 생성된 초안이 없습니다."}</div>
              </div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  margin: "12px 0 0",
                  maxHeight: 240,
                  overflow: "auto",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {streamedContent || "원고 생성을 시작하면 초안이 이 영역에 쌓입니다."}
              </pre>
            </div>
          </div>
        </section>

        {error ? <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p> : null}

        <section
          style={{
            background: "rgba(255,255,255,0.84)",
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,0.78)",
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              padding: "18px 20px",
              borderBottom: "1px solid #f1f5f9",
              background: "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.72))",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ fontSize: 18 }}>키워드 워리어</strong>
              <span style={{ color: "#64748b", fontSize: 14 }}>
                현재 필터 결과 {visibleKeywords.length}건
                {" · "}
                언어 {language === "ja" ? "일본어" : language === "ko" ? "한국어" : "영어"}
                {" · "}
                보기 {sourceView === "all" ? "전체 보기" : sourceView === "google_ads" ? "Google Ads만" : sourceView === "keyword_planner" ? "Keyword Planner만" : "Search Console만"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} style={sortSelectStyle}>
                <option value="volume">노출/검색량 기준</option>
                <option value="clicks">클릭/전환 기준</option>
                <option value="ctr">CTR 기준</option>
                <option value="cpc">CPC 기준</option>
                <option value="rank">평균순위/경쟁도 기준</option>
                <option value="keyword">키워드명 기준</option>
              </select>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)} style={sortSelectStyle}>
                <option value="desc">내림차순</option>
                <option value="asc">오름차순</option>
              </select>
            </div>
          </div>
          {visibleKeywords.length === 0 ? (
            <div style={{ padding: 28, display: "grid", gap: 8 }}>
              <strong style={{ fontSize: 18 }}>현재 조건에서 보이는 키워드가 없습니다</strong>
              <span style={{ color: "#64748b" }}>
                키워드를 불러온 뒤에도 비어 보이면, 위에서 수집 언어와 노출 방식이 현재 데이터와 맞는지 확인해 주세요.
              </span>
              <span style={{ color: "#64748b" }}>
                예: 일본어로 불러왔다면 언어를 `일본어`, 보기 방식을 `Google Ads + Keyword Planner`로 두는 것이 가장 안전합니다.
              </span>
            </div>
          ) : null}
          <KeywordTable keywords={visibleKeywords} selectedIds={selectedIds} onSelect={setSelectedIds} />
        </section>
      </section>
    </main>
  );
}

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  color: "#334155",
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "#fff",
  padding: "14px 16px",
  fontSize: 15,
  boxSizing: "border-box",
};

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 24,
        background: "rgba(255,255,255,0.84)",
        border: "1px solid rgba(255,255,255,0.78)",
        boxShadow: "0 20px 60px rgba(15, 23, 42, 0.07)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: accent,
          opacity: 0.08,
        }}
      />
      <div style={{ position: "relative" }}>
        <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>{label}</p>
        <strong style={{ fontSize: 32, lineHeight: 1.1 }}>{value}</strong>
      </div>
    </div>
  );
}

function compareKeywords(
  a: {
    keyword: string;
    source: string;
    search_volume?: number | null;
    impressions?: number;
    position?: number;
    competition_level?: string | null;
    avg_cpc?: number | null;
    clicks?: number;
    conversions?: number;
    ctr?: number;
    conversion_rate?: number;
  },
  b: {
    keyword: string;
    source: string;
    search_volume?: number | null;
    impressions?: number;
    position?: number;
    competition_level?: string | null;
    avg_cpc?: number | null;
    clicks?: number;
    conversions?: number;
    ctr?: number;
    conversion_rate?: number;
  },
  sortKey: "keyword" | "volume" | "rank" | "cpc" | "clicks" | "ctr",
  sortOrder: "desc" | "asc",
) {
  const competitionScore = (value?: string | null) => (value === "HIGH" ? 3 : value === "MEDIUM" ? 2 : value === "LOW" ? 1 : 0);
  const aValue =
    sortKey === "keyword"
      ? a.keyword.toLowerCase()
      : sortKey === "volume"
        ? Number(a.source === "search_console" ? a.impressions ?? a.search_volume ?? 0 : a.search_volume ?? 0)
        : sortKey === "rank"
          ? Number(a.source === "search_console" ? a.position ?? 999 : competitionScore(a.competition_level))
          : sortKey === "cpc"
            ? Number(a.avg_cpc ?? 0)
            : sortKey === "clicks"
              ? Number(a.source === "search_console" ? a.clicks ?? 0 : a.conversions ?? 0)
              : Number(a.source === "search_console" ? a.ctr ?? a.conversion_rate ?? 0 : a.conversion_rate ?? 0);
  const bValue =
    sortKey === "keyword"
      ? b.keyword.toLowerCase()
      : sortKey === "volume"
        ? Number(b.source === "search_console" ? b.impressions ?? b.search_volume ?? 0 : b.search_volume ?? 0)
        : sortKey === "rank"
          ? Number(b.source === "search_console" ? b.position ?? 999 : competitionScore(b.competition_level))
          : sortKey === "cpc"
            ? Number(b.avg_cpc ?? 0)
            : sortKey === "clicks"
              ? Number(b.source === "search_console" ? b.clicks ?? 0 : b.conversions ?? 0)
              : Number(b.source === "search_console" ? b.ctr ?? b.conversion_rate ?? 0 : b.conversion_rate ?? 0);

  let comparison = 0;
  if (typeof aValue === "string" && typeof bValue === "string") {
    comparison = aValue.localeCompare(bValue);
  } else {
    comparison = Number(aValue) - Number(bValue);
  }
  return sortOrder === "asc" ? comparison : comparison * -1;
}
