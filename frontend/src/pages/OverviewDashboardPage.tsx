import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { fetchBlogPosts, fetchGapMatrix, fetchMixRatio, syncInventory, type GapEntry, type MixRatioData } from "../lib/api";
import { getKeywordSegment, type KeywordSegment } from "../lib/keywordInsights";
import { useKeywords } from "../hooks/useKeywords";
import type { BlogPost } from "../types";
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

export default function OverviewDashboardPage() {
  const { keywords } = useKeywords();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [gapEntries, setGapEntries] = useState<GapEntry[]>([]);
  const [mixRatio, setMixRatio] = useState<MixRatioData | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void fetchBlogPosts().then((data) => setPosts(data.posts)).catch(() => setPosts([]));
    void fetchGapMatrix().then((data) => setGapEntries(data.entries)).catch(() => setGapEntries([]));
    void fetchMixRatio().then(setMixRatio).catch(() => setMixRatio(null));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncInventory();
      const [gapData, mixData] = await Promise.all([fetchGapMatrix(), fetchMixRatio()]);
      setGapEntries(gapData.entries);
      setMixRatio(mixData);
    } catch { /* ignore */ }
    setSyncing(false);
  };

  const portfolio = useMemo(() => {
    const segmentCounts: Record<KeywordSegment, number> = { Hero: 0, Hub: 0, Hygiene: 0 };
    const missingCounts: Record<KeywordSegment, number> = { Hero: 0, Hub: 0, Hygiene: 0 };
    const performance: Record<KeywordSegment, { volume: number; engagement: number; rate: number; count: number }> = {
      Hero: { volume: 0, engagement: 0, rate: 0, count: 0 },
      Hub: { volume: 0, engagement: 0, rate: 0, count: 0 },
      Hygiene: { volume: 0, engagement: 0, rate: 0, count: 0 },
    };

    const postKeywords = new Set(posts.map((post) => post.keyword));
    keywords.forEach((keyword) => {
      const segment = getKeywordSegment(keyword);
      segmentCounts[segment] += 1;
      if (!postKeywords.has(keyword.keyword)) {
        missingCounts[segment] += 1;
      }
      const volume = keyword.source === "search_console" ? keyword.impressions ?? 0 : keyword.search_volume ?? 0;
      const engagement = keyword.source === "search_console" ? keyword.clicks ?? 0 : keyword.conversions ?? 0;
      const rate = keyword.source === "search_console" ? keyword.ctr ?? 0 : keyword.conversion_rate ?? 0;
      performance[segment].volume += volume;
      performance[segment].engagement += engagement;
      performance[segment].rate += rate;
      performance[segment].count += 1;
    });

    return { segmentCounts, missingCounts, performance };
  }, [keywords, posts]);

  return (
    <main style={pageStyle}>
      <section style={sectionStyle}>
        <header style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#e11d48" }}>대시보드</div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.04 }}>콘텐츠 포트폴리오 현황</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 16 }}>
            지금까지 만든 콘텐츠, 비어 있는 갭, 어떤 유형이 잘 노출되는지를 한눈에 봅니다.
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <StatCard label="누적 원고 수" value={posts.length} />
          <StatCard label="현재 키워드 풀" value={keywords.length} />
          <StatCard label="보강 필요 갭" value={portfolio.missingCounts.Hero + portfolio.missingCounts.Hub + portfolio.missingCounts.Hygiene} />
          <StatCard label="Search Console 소스" value={keywords.filter((item) => item.source === "search_console").length} />
        </section>

        <section style={panelStyle}>
          <h3 style={{ margin: 0, fontSize: 22 }}>Hero / Hub / Hygiene 포트폴리오</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {(["Hero", "Hub", "Hygiene"] as KeywordSegment[]).map((segment) => (
              <div key={segment} style={innerCardStyle}>
                <strong style={{ fontSize: 20 }}>{segment}</strong>
                <span style={{ color: "#64748b" }}>현재 키워드 {portfolio.segmentCounts[segment]}건</span>
                <span style={{ color: "#b45309", fontWeight: 700 }}>보강 필요 {portfolio.missingCounts[segment]}건</span>
              </div>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <h3 style={{ margin: 0, fontSize: 22 }}>유형별 성과 감</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {(["Hero", "Hub", "Hygiene"] as KeywordSegment[]).map((segment) => {
              const item = portfolio.performance[segment];
              const averageRate = item.count ? (item.rate / item.count).toFixed(2) : "0.00";
              return (
                <div key={segment} style={performanceRowStyle}>
                  <strong style={{ width: 110 }}>{segment}</strong>
                  <span>평균 노출/검색량 {Math.round(item.volume / Math.max(1, item.count))}</span>
                  <span>평균 클릭/전환 {Math.round(item.engagement / Math.max(1, item.count))}</span>
                  <span>평균 반응률 {averageRate}%</span>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ ...panelStyle, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 22 }}>콘텐츠 믹스 비율</h3>
              <button type="button" onClick={() => void handleSync()} disabled={syncing} style={syncButtonStyle}>
                {syncing ? "동기화 중..." : "인벤토리 동기화"}
              </button>
            </div>
            {mixRatio ? (
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "center" }}>
                <DonutChart
                  title="실제 비율"
                  slices={[
                    { label: "Hero", value: mixRatio.actual_counts.hero, color: "#e11d48" },
                    { label: "Hub", value: mixRatio.actual_counts.hub, color: "#7c3aed" },
                    { label: "Hygiene", value: mixRatio.actual_counts.hygiene, color: "#0ea5e9" },
                  ]}
                />
                <div style={{ display: "grid", gap: 10 }}>
                  <strong style={{ fontSize: 14, color: "#64748b" }}>목표 대비 차이</strong>
                  {(["hero", "hub", "hygiene"] as const).map((seg) => {
                    const gap = mixRatio.gaps[seg];
                    const color = gap > 0 ? "#b45309" : "#16a34a";
                    return (
                      <div key={seg} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 12, background: "#f8fafc" }}>
                        <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{seg}</span>
                        <span>실제 {mixRatio.actual_pct[seg]}% / 목표 {mixRatio.target_pct[seg]}%</span>
                        <span style={{ color, fontWeight: 700 }}>{gap > 0 ? `+${gap}% 부족` : `${Math.abs(gap)}% 초과`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ color: "#94a3b8" }}>인벤토리를 동기화하면 믹스 비율이 표시됩니다.</div>
            )}
          </div>
          <div>
            <DonutChart
              title="목표 비율 (20:30:50)"
              slices={[
                { label: "Hero (20%)", value: 20, color: "#fecdd3" },
                { label: "Hub (30%)", value: 30, color: "#ddd6fe" },
                { label: "Hygiene (50%)", value: 50, color: "#bae6fd" },
              ]}
              size={160}
              strokeWidth={24}
            />
          </div>
        </section>

        <section style={panelStyle}>
          <h3 style={{ margin: 0, fontSize: 22 }}>콘텐츠 갭 매트릭스 (수요 vs 공급)</h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            수요(검색량/노출)는 높지만 아직 콘텐츠가 없는 키워드를 우선 표시합니다.
          </p>
          {gapEntries.length > 0 ? (
            <div style={{ display: "grid", gap: 2, maxHeight: 400, overflow: "auto" }}>
              <div style={gapHeaderStyle}>
                <span>키워드</span>
                <span>소스</span>
                <span>인텐트</span>
                <span>수요</span>
                <span>점수</span>
                <span>커버</span>
                <span>플래그</span>
              </div>
              {gapEntries.slice(0, 30).map((entry) => (
                <div key={entry.keyword + entry.source} style={{
                  ...gapRowStyle,
                  background: entry.is_covered ? "#f0fdf4" : entry.gap_severity > 100 ? "#fef2f2" : "#fffbeb",
                }}>
                  <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.keyword}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{entry.source.replace("_", " ")}</span>
                  <span style={{ fontSize: 12, textTransform: "capitalize" }}>{entry.intent_segment}</span>
                  <span>{entry.demand.toLocaleString()}</span>
                  <span>{entry.weighted_score}</span>
                  <span>{entry.is_covered ? "✓" : "✗"}</span>
                  <span style={{ fontSize: 11 }}>{entry.opportunity_flag ? flagLabel(entry.opportunity_flag) : "-"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#94a3b8" }}>키워드 데이터가 로드되면 갭 매트릭스가 표시됩니다.</div>
          )}
        </section>

        <section style={panelStyle}>
          <h3 style={{ margin: 0, fontSize: 22 }}>최근 생성된 콘텐츠</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {posts.slice(-8).reverse().map((post) => (
              <div key={post.id} style={innerCardStyle}>
                <strong>{post.keyword}</strong>
                <span style={{ color: "#64748b" }}>상태: {post.status ?? "draft"} · 생성일: {post.created_at ?? "-"}</span>
              </div>
            ))}
            {posts.length === 0 ? <div style={{ color: "#64748b" }}>아직 생성된 원고가 없습니다.</div> : null}
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

const innerCardStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "14px 16px",
  borderRadius: 18,
  background: "#fff",
  border: "1px solid #eef2f7",
};

const performanceRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px repeat(3, 1fr)",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 18,
  background: "#fff",
  border: "1px solid #eef2f7",
  alignItems: "center",
};

const syncButtonStyle: CSSProperties = {
  padding: "6px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const gapHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.8fr 0.6fr 1fr",
  gap: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
  borderBottom: "1px solid #e2e8f0",
};

const gapRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.8fr 0.6fr 1fr",
  gap: 8,
  padding: "8px 12px",
  fontSize: 13,
  borderRadius: 8,
  alignItems: "center",
};

function flagLabel(flag: string): string {
  switch (flag) {
    case "new_opportunity": return "🆕 신규 기회";
    case "rewrite_candidate": return "✏️ 리라이팅";
    case "hero_locked": return "🔒 Hero 고정";
    default: return flag;
  }
}
