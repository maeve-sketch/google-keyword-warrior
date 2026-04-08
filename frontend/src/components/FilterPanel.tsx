import { useState } from "react";
import { PLANNER_SEED_PRESETS } from "../lib/plannerSeedPresets";

type FilterPanelProps = {
  onRefresh: () => void;
  isLoading: boolean;
  isRefreshing: boolean;
  language: string;
  onLanguageChange: (language: string) => void;
  dateRange: string;
  onDateRangeChange: (dateRange: string) => void;
  minSearchVolume: number;
  onMinSearchVolumeChange: (value: number) => void;
  searchConsoleMinImpressions: number;
  onSearchConsoleMinImpressionsChange: (value: number) => void;
  adsMinClicks: number;
  onAdsMinClicksChange: (value: number) => void;
  adsMinSpend: number;
  onAdsMinSpendChange: (value: number) => void;
  plannerSeedText: string;
  onPlannerSeedTextChange: (value: string) => void;
  sourceView: "all" | "google_ads" | "keyword_planner" | "search_console";
  onSourceViewChange: (sourceView: "all" | "google_ads" | "keyword_planner" | "search_console") => void;
  fetchFeedback: {
    kind: "loading" | "success" | "error";
    title: string;
    description: string;
  } | null;
  lastFetchedAt: string;
  lastInsertedCount: number;
};

const cardStyle = {
  padding: 20,
  background: "rgba(255,255,255,0.82)",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
  backdropFilter: "blur(18px)",
} as const;

const chipStyle = (active: boolean) =>
  ({
    border: "none",
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
    background: active ? "linear-gradient(135deg, #fd1d1d, #fcb045)" : "#fff",
    color: active ? "#fff" : "#475569",
    boxShadow: active ? "0 10px 24px rgba(253, 29, 29, 0.22)" : "inset 0 0 0 1px #e5e7eb",
  }) as const;

export default function FilterPanel({
  onRefresh,
  isLoading,
  isRefreshing,
  language,
  onLanguageChange,
  dateRange,
  onDateRangeChange,
  minSearchVolume,
  onMinSearchVolumeChange,
  searchConsoleMinImpressions,
  onSearchConsoleMinImpressionsChange,
  adsMinClicks,
  onAdsMinClicksChange,
  adsMinSpend,
  onAdsMinSpendChange,
  plannerSeedText,
  onPlannerSeedTextChange,
  sourceView,
  onSourceViewChange,
  fetchFeedback,
  lastFetchedAt,
  lastInsertedCount,
}: FilterPanelProps) {
  const [showManual, setShowManual] = useState(false);

  const currentSeeds = plannerSeedText
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

  const applyPreset = (keywords: string[], mode: "replace" | "append") => {
    const normalizedPreset = keywords.join("\n");
    if (mode === "replace" || !plannerSeedText.trim()) {
      onPlannerSeedTextChange(normalizedPreset);
      return;
    }

    const existing = plannerSeedText
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    const merged = Array.from(new Set([...existing, ...keywords]));
    onPlannerSeedTextChange(merged.join("\n"));
  };

  return (
    <section style={cardStyle}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fd1d1d", letterSpacing: "0.08em", textTransform: "uppercase" }}>Keyword Warrior</div>
            <h3 style={{ margin: "6px 0 4px", fontSize: 24 }}>키워드 워리어</h3>
            <p style={{ margin: 0, color: "#64748b" }}>PRD 기준(GKP 50% · GSC 30% · Ads 20%)으로 자동 수집합니다. 언어와 시드만 선택하면 바로 시작됩니다.</p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "14px 22px",
              background: isRefreshing ? "#cbd5e1" : "linear-gradient(135deg, #833ab4, #fd1d1d 55%, #fcb045)",
              color: "#fff",
              fontWeight: 800,
              cursor: isRefreshing ? "not-allowed" : "pointer",
              boxShadow: isRefreshing ? "none" : "0 16px 40px rgba(253, 29, 29, 0.26)",
            }}
          >
            {isRefreshing ? "불러오는 중..." : "지금 키워드 불러오기"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 16, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 8, color: "#334155", fontWeight: 700 }}>
            수집 언어
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              style={{
                width: "100%",
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                background: "#fff",
                padding: "14px 16px",
                fontSize: 15,
              }}
            >
              <option value="ja">일본어</option>
              <option value="ko">한국어</option>
              <option value="en">영어</option>
              <option value="zh-TW">대만어 (繁體中文)</option>
            </select>
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "#334155", fontWeight: 700 }}>노출 방식</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => onSourceViewChange("all")} style={chipStyle(sourceView === "all")}>
                전체 보기
              </button>
              <button type="button" onClick={() => onSourceViewChange("google_ads")} style={chipStyle(sourceView === "google_ads")}>
                Google Ads
              </button>
              <button type="button" onClick={() => onSourceViewChange("keyword_planner")} style={chipStyle(sourceView === "keyword_planner")}>
                Planner
              </button>
              <button type="button" onClick={() => onSourceViewChange("search_console")} style={chipStyle(sourceView === "search_console")}>
                Search Console
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => setShowManual((prev) => !prev)}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 999,
              padding: "8px 14px",
              background: showManual ? "#0f172a" : "#f8fafc",
              color: showManual ? "#fff" : "#64748b",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {showManual ? "수동 조정 닫기 ▲" : "수동 조정 ▼"}
          </button>
          {!showManual ? (
            <span style={{ color: "#94a3b8", fontSize: 13 }}>
              검색량 {minSearchVolume}+ · SC 노출 {searchConsoleMinImpressions}+ · Ads 클릭 {adsMinClicks}+ · 기간 {dateRange}
            </span>
          ) : null}
        </div>

        {showManual ? (
          <div style={{ display: "grid", gap: 16, padding: "16px 18px", borderRadius: 18, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>PRD 기본값이 적용되어 있습니다. 특수한 탐색이 필요할 때만 조정하세요.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <label style={{ display: "grid", gap: 8, color: "#334155", fontWeight: 700 }}>
                수집 기간
                <select
                  value={dateRange}
                  onChange={(e) => onDateRangeChange(e.target.value)}
                  style={numberInputStyle}
                >
                  <option value="7d">최근 7일</option>
                  <option value="30d">최근 30일</option>
                  <option value="90d">최근 90일</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 8, color: "#334155", fontWeight: 700 }}>
                최소 검색량
                <input type="number" min={0} value={minSearchVolume} onChange={(e) => onMinSearchVolumeChange(Number(e.target.value) || 0)} style={numberInputStyle} />
              </label>
              <label style={{ display: "grid", gap: 8, color: "#334155", fontWeight: 700 }}>
                SC 최소 노출수
                <input type="number" min={0} value={searchConsoleMinImpressions} onChange={(e) => onSearchConsoleMinImpressionsChange(Number(e.target.value) || 0)} style={numberInputStyle} />
              </label>
              <label style={{ display: "grid", gap: 8, color: "#334155", fontWeight: 700 }}>
                Ads 최소 클릭수
                <input type="number" min={0} value={adsMinClicks} onChange={(e) => onAdsMinClicksChange(Number(e.target.value) || 0)} style={numberInputStyle} />
              </label>
              <label style={{ display: "grid", gap: 8, color: "#334155", fontWeight: 700 }}>
                Ads 최소 비용
                <input type="number" min={0} step={1000} value={adsMinSpend} onChange={(e) => onAdsMinSpendChange(Number(e.target.value) || 0)} style={numberInputStyle} />
              </label>
            </div>
          </div>
        ) : null}

        <label style={{ display: "grid", gap: 8, color: "#334155", fontWeight: 700 }}>
          Keyword Planner 시드 키워드 직접 지정
          <textarea
            value={plannerSeedText}
            onChange={(e) => onPlannerSeedTextChange(e.target.value)}
            placeholder="줄바꿈 또는 쉼표로 입력하세요. 비워두면 Google Ads 상위 검색어를 시드로 사용합니다."
            style={{
              width: "100%",
              minHeight: 96,
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              background: "#fff",
              padding: "14px 16px",
              fontSize: 15,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        </label>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 16,
            background: "#f8fafc",
            color: "#475569",
            border: "1px solid #e2e8f0",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 800 }}>현재 적용된 Keyword Planner seed: {currentSeeds.length}개</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {currentSeeds.slice(0, 10).map((seed) => (
              <span
                key={seed}
                style={{
                  borderRadius: 999,
                  padding: "4px 8px",
                  background: "#fff",
                  color: "#334155",
                  fontSize: 12,
                  fontWeight: 700,
                  boxShadow: "inset 0 0 0 1px #e2e8f0",
                }}
              >
                {seed}
              </span>
            ))}
            {currentSeeds.length > 10 ? (
              <span
                style={{
                  borderRadius: 999,
                  padding: "4px 8px",
                  background: "#fff7ed",
                  color: "#c2410c",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                +{currentSeeds.length - 10}개 더
              </span>
            ) : null}
            {currentSeeds.length === 0 ? <span style={{ fontSize: 13 }}>아직 직접 지정된 seed가 없습니다.</span> : null}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ color: "#334155", fontWeight: 800 }}>
              {language === "ja" ? "일본" : language === "ko" ? "한국" : language === "zh-TW" ? "대만" : "영어"} 시장용 seed 세트
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              `세트 불러오기`는 교체, `뒤에 추가`는 현재 입력 뒤에 합칩니다.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {PLANNER_SEED_PRESETS.filter((preset) => preset.language === language).map((preset) => (
              <div
                key={preset.id}
                style={{
                  borderRadius: 18,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  padding: 14,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ color: "#0f172a" }}>{preset.label}</strong>
                  <span style={{ color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>{preset.description}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {preset.keywords.slice(0, 4).map((keyword) => (
                    <span
                      key={keyword}
                      style={{
                        borderRadius: 999,
                        padding: "4px 8px",
                        background: "#f8fafc",
                        color: "#475569",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {keyword}
                    </span>
                  ))}
                  {preset.keywords.length > 4 ? (
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "4px 8px",
                        background: "#fff7ed",
                        color: "#c2410c",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      +{preset.keywords.length - 4}개
                    </span>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => applyPreset(preset.keywords, "replace")} style={presetPrimaryButtonStyle}>
                    세트 불러오기
                  </button>
                  <button type="button" onClick={() => applyPreset(preset.keywords, "append")} style={presetGhostButtonStyle}>
                    뒤에 추가
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderRadius: 18,
            background: "#f0f9ff",
            color: "#0c4a6e",
            border: "1px solid #bae6fd",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          GKP(50%) · GSC(30%) · Ads(20%) 가중치 기준으로 수집합니다. 시드를 비워두면 Ads 상위 검색어를 자동 시드로 사용합니다.
        </div>

        {fetchFeedback ? (
          <div
            style={{
              display: "grid",
              gap: 6,
              padding: "16px 18px",
              borderRadius: 20,
              background:
                fetchFeedback.kind === "loading"
                  ? "#eff6ff"
                  : fetchFeedback.kind === "success"
                    ? "#ecfdf5"
                    : "#fef2f2",
              color:
                fetchFeedback.kind === "loading"
                  ? "#1d4ed8"
                  : fetchFeedback.kind === "success"
                    ? "#047857"
                    : "#b91c1c",
              border:
                fetchFeedback.kind === "loading"
                  ? "1px solid #bfdbfe"
                  : fetchFeedback.kind === "success"
                    ? "1px solid #a7f3d0"
                    : "1px solid #fecaca",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <strong style={{ fontSize: 15 }}>
                {fetchFeedback.kind === "loading" ? "● " : fetchFeedback.kind === "success" ? "✓ " : "! "}
                {fetchFeedback.title}
              </strong>
              {lastFetchedAt ? (
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  마지막 반영: {lastFetchedAt}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 14, wordBreak: "break-word", overflowWrap: "anywhere", maxHeight: 120, overflow: "auto" }}>{fetchFeedback.description}</div>
            {lastInsertedCount > 0 && fetchFeedback.kind !== "loading" ? (
              <div style={{ fontSize: 13, fontWeight: 700 }}>이번 반영 키워드 수: {lastInsertedCount}건</div>
            ) : null}
          </div>
        ) : null}

        {isLoading && !fetchFeedback ? (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 18,
              background: "#f8fafc",
              color: "#475569",
              border: "1px solid #e2e8f0",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            목록을 불러오는 중입니다...
          </div>
        ) : null}
      </div>
    </section>
  );
}

const numberInputStyle = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "#fff",
  padding: "14px 16px",
  fontSize: 15,
  boxSizing: "border-box",
} as const;

const presetPrimaryButtonStyle = {
  border: "none",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
  background: "linear-gradient(135deg, #833ab4, #fd1d1d 55%, #fcb045)",
  color: "#fff",
  boxShadow: "0 12px 24px rgba(253, 29, 29, 0.18)",
} as const;

const presetGhostButtonStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
  background: "#fff",
  color: "#475569",
} as const;
