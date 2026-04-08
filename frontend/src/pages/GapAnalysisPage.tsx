import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { fetchGapMatrix, fetchMixRatio, syncInventory, type GapEntry, type MixRatioData } from "../lib/api";
import DonutChart from "../components/DonutChart";

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

export default function GapAnalysisPage() {
  const [gapEntries, setGapEntries] = useState<GapEntry[]>([]);
  const [mixRatio, setMixRatio] = useState<MixRatioData | null>(null);
  const [filter, setFilter] = useState<"all" | "uncovered" | "new_opportunity" | "rewrite_candidate">("uncovered");
  const [syncing, setSyncing] = useState(false);

  const loadData = () => {
    void fetchGapMatrix().then((d) => setGapEntries(d.entries)).catch(() => setGapEntries([]));
    void fetchMixRatio().then(setMixRatio).catch(() => setMixRatio(null));
  };

  useEffect(loadData, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncInventory();
      loadData();
    } catch { /* ignore */ }
    setSyncing(false);
  };

  const filtered = gapEntries.filter((e) => {
    if (filter === "uncovered") return !e.is_covered;
    if (filter === "new_opportunity") return e.opportunity_flag === "new_opportunity";
    if (filter === "rewrite_candidate") return e.opportunity_flag === "rewrite_candidate";
    return true;
  });

  return (
    <main style={pageStyle}>
      <section style={sectionStyle}>
        <header style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#7c3aed" }}>갭 분석</div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.04 }}>수요 vs 공급 갭 분석</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 16 }}>
            시장 수요(GKP/GSC)와 보유 콘텐츠를 대조하여 비어있는 키워드를 찾습니다.
          </p>
        </header>

        {mixRatio ? (
          <section style={{ ...panelStyle, display: "grid", gridTemplateColumns: "auto 1fr", gap: 28 }}>
            <DonutChart
              title="현재 콘텐츠 믹스"
              slices={[
                { label: "Hero", value: mixRatio.actual_counts.hero, color: "#e11d48" },
                { label: "Hub", value: mixRatio.actual_counts.hub, color: "#7c3aed" },
                { label: "Hygiene", value: mixRatio.actual_counts.hygiene, color: "#0ea5e9" },
              ]}
            />
            <div style={{ display: "grid", gap: 12, alignContent: "center" }}>
              <strong style={{ fontSize: 16 }}>콘텐츠 보강 가이드</strong>
              {(["hero", "hub", "hygiene"] as const).map((seg) => {
                const gap = mixRatio.gaps[seg];
                if (gap <= 0) return null;
                return (
                  <div key={seg} style={{ padding: "10px 14px", borderRadius: 14, background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <strong style={{ textTransform: "capitalize" }}>{seg}</strong> 콘텐츠가 목표 대비 <strong style={{ color: "#b45309" }}>{gap}%</strong> 부족합니다.
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => void handleSync()} disabled={syncing} style={actionBtnStyle}>
                  {syncing ? "동기화 중..." : "인벤토리 동기화"}
                </button>
                <Link to="/workflow/select" style={{ ...actionBtnStyle, background: "#7c3aed", color: "#fff", textDecoration: "none" }}>
                  키워드 선정으로 이동 →
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 22 }}>키워드 갭 목록</h3>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                ["all", "전체"],
                ["uncovered", "미커버"],
                ["new_opportunity", "신규 기회"],
                ["rewrite_candidate", "리라이팅"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  style={{
                    ...filterBtnStyle,
                    background: filter === key ? "#0f172a" : "#f1f5f9",
                    color: filter === key ? "#fff" : "#475569",
                  }}
                >
                  {label} ({key === "all" ? gapEntries.length : gapEntries.filter((e) => key === "uncovered" ? !e.is_covered : e.opportunity_flag === key).length})
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 2, maxHeight: 500, overflow: "auto" }}>
            <div style={headerRowStyle}>
              <span>키워드</span>
              <span>소스</span>
              <span>인텐트</span>
              <span>수요</span>
              <span>점수</span>
              <span>상태</span>
            </div>
            {filtered.slice(0, 50).map((entry) => (
              <div
                key={entry.keyword + entry.source}
                style={{
                  ...rowStyle,
                  background: entry.is_covered ? "#f0fdf4" : entry.gap_severity > 100 ? "#fef2f2" : "#fffbeb",
                }}
              >
                <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.keyword}
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{entry.source.replace("_", " ")}</span>
                <span style={segmentBadgeStyle(entry.intent_segment)}>{entry.intent_segment}</span>
                <span style={{ fontWeight: 600 }}>{entry.demand.toLocaleString()}</span>
                <span>{entry.weighted_score}</span>
                <span style={{ fontSize: 12 }}>
                  {entry.is_covered ? "✓ 커버됨" : entry.opportunity_flag === "new_opportunity" ? "🆕 신규 기회" : entry.opportunity_flag === "rewrite_candidate" ? "✏️ 리라이팅" : entry.opportunity_flag === "hero_locked" ? "🔒 Hero" : "✗ 미커버"}
                </span>
              </div>
            ))}
            {filtered.length === 0 ? (
              <div style={{ padding: 20, color: "#94a3b8", textAlign: "center" }}>해당 조건의 키워드가 없습니다.</div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function segmentBadgeStyle(segment: string): CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    hero: { bg: "#fff7ed", fg: "#c2410c" },
    hub: { bg: "#eff6ff", fg: "#1d4ed8" },
    hygiene: { bg: "#ecfdf5", fg: "#047857" },
  };
  const c = colors[segment] ?? colors.hygiene;
  return {
    borderRadius: 999,
    padding: "4px 10px",
    background: c.bg,
    color: c.fg,
    fontWeight: 700,
    fontSize: 12,
    textTransform: "capitalize",
  };
}

const actionBtnStyle: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const filterBtnStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};

const headerRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2.5fr 1fr 0.8fr 0.8fr 0.8fr 1.2fr",
  gap: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
  borderBottom: "1px solid #e2e8f0",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2.5fr 1fr 0.8fr 0.8fr 0.8fr 1.2fr",
  gap: 8,
  padding: "10px 12px",
  fontSize: 13,
  borderRadius: 8,
  alignItems: "center",
};
