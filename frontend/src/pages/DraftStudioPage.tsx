import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import GenerateButton from "../components/GenerateButton";
import { useBlogGenerate } from "../hooks/useBlogGenerate";
import { useKeywords } from "../hooks/useKeywords";
import { translateKeywordToKorean } from "../lib/keywordInsights";
import { syncInventory } from "../lib/api";
import { loadSelectedKeywordIds } from "../lib/workflowState";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(252,176,69,0.18), transparent 22%), radial-gradient(circle at top right, rgba(131,58,180,0.14), transparent 24%), linear-gradient(180deg, #fff7f3 0%, #fff 32%, #fff5f7 100%)",
};

const sectionStyle: CSSProperties = {
  maxWidth: 1680,
  margin: "0 auto",
  padding: "24px 24px 48px",
  display: "grid",
  gap: 18,
};

type DraftStructure = {
  seoTitle: string;
  metaImage: string;
  description: string;
  slug: string;
  koreanMemo: string[];
  articleTitle: string;
  articleBody: string;
  meta: string;
};

const API_KEY_STORAGE_PREFIX = "gkw:api-key:";

function stripHtmlLikeTags(value: string): string {
  return value.replace(/<\/?aside>/g, "").trim();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

function parseDraftStructure(raw: string): DraftStructure {
  const extract = (start: string, end?: string) => {
    const startIndex = raw.indexOf(start);
    if (startIndex === -1) return "";
    const contentStart = startIndex + start.length;
    const endIndex = end ? raw.indexOf(end, contentStart) : -1;
    return (endIndex === -1 ? raw.slice(contentStart) : raw.slice(contentStart, endIndex)).trim();
  };

  const seoSection = extract("## SEO", "---SLUG---");
  const slug = extract("---SLUG---", "## 한국어 확인 메모");
  const koreanMemoSection = extract("## 한국어 확인 메모", "## 제목");
  const titleSection = extract("## 제목", "---META---");
  const meta = extract("---META---");

  const seoTitle = stripHtmlLikeTags((seoSection.match(/Title:\s*([\s\S]*?)(?:<\/aside>|Meta Image:|$)/)?.[1] ?? "").trim());
  const metaImage = stripHtmlLikeTags((seoSection.match(/Meta Image:\s*([\s\S]*?)(?:<\/aside>|Description:|$)/)?.[1] ?? "").trim());
  const description = collapseWhitespace(
    stripHtmlLikeTags((seoSection.match(/Description:\s*([\s\S]*?)(?:<\/aside>|$)/)?.[1] ?? "").trim()),
  );

  const koreanMemo = koreanMemoSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"));

  const articleTitleMatch = titleSection.match(/:\s*(.+)/);
  const articleTitle = collapseWhitespace(stripHtmlLikeTags((articleTitleMatch?.[1] ?? seoTitle).trim()));
  let articleBody = collapseWhitespace(
    titleSection
      .split("\n")
      .slice(1)
      .join("\n")
      .trim(),
  );

  if (!articleBody) {
    const afterTitle = raw.split("## 제목").slice(1).join("## 제목");
    if (afterTitle) {
      articleBody = collapseWhitespace(
        afterTitle
          .split("---META---")[0]
          .split("\n")
          .slice(1)
          .join("\n")
          .trim(),
      );
    }
  }

  if (!articleBody) {
    articleBody = collapseWhitespace(
      raw
        .replace(seoSection, "")
        .replace(slug, "")
        .replace(koreanMemoSection, "")
        .replace(meta, "")
        .replace("## SEO", "")
        .replace("---SLUG---", "")
        .replace("## 한국어 확인 메모", "")
        .replace("---META---", ""),
    );
  }

  return { seoTitle, metaImage, description, slug: slug.trim(), koreanMemo, articleTitle, articleBody, meta: meta.trim() };
}

function escapeHtml(value: string): string {
  return value
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

function renderInlineHtml(value: string): string {
  const parts = value.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

function renderInlineNodes(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function renderArticleHtml(articleTitle: string, body: string): string {
  const lines = body.split("\n");
  const html: string[] = [`<h1>${renderInlineHtml(articleTitle)}</h1>`];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    html.push(`<ul>${listBuffer.map((item) => `<li>${renderInlineHtml(item)}</li>`).join("")}</ul>`);
    listBuffer = [];
  };

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    flushList();
    html.push(`<p>${renderInlineHtml(paragraphBuffer.join(" "))}</p>`);
    paragraphBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      html.push(`<h2>${renderInlineHtml(line.replace(/^##\s+/, ""))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      html.push(`<h3>${renderInlineHtml(line.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      listBuffer.push(line.replace(/^- /, ""));
      continue;
    }
    if (line.startsWith("[IMAGE_SLOT:")) {
      flushParagraph();
      flushList();
      html.push(`<div data-slot="image" style="padding:12px 14px;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;color:#475569;">${renderInlineHtml(line)}</div>`);
      continue;
    }
    if (line.startsWith("[CTA_BANNER:")) {
      flushParagraph();
      flushList();
      html.push(`<div data-slot="cta" style="padding:14px 16px;border-radius:14px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-weight:700;">${renderInlineHtml(line)}</div>`);
      continue;
    }
    paragraphBuffer.push(line);
  }
  flushParagraph();
  flushList();
  return html.join("\n");
}

function renderArticleNodes(body: string) {
  const lines = body.split("\n");
  const blocks: Array<{ type: string; value: string; key: string }> = [];
  let paragraphBuffer: string[] = [];
  let paragraphIndex = 0;

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push({ type: "p", value: paragraphBuffer.join(" "), key: `p-${paragraphIndex++}` });
    paragraphBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "h2", value: line.replace(/^##\s+/, ""), key: `h2-${blocks.length}` });
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push({ type: "h3", value: line.replace(/^###\s+/, ""), key: `h3-${blocks.length}` });
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      blocks.push({ type: "li", value: line.replace(/^- /, ""), key: `li-${blocks.length}` });
      continue;
    }
    if (line.startsWith("[IMAGE_SLOT:")) {
      flushParagraph();
      blocks.push({ type: "image-slot", value: line, key: `img-${blocks.length}` });
      continue;
    }
    if (line.startsWith("[CTA_BANNER:")) {
      flushParagraph();
      blocks.push({ type: "cta-slot", value: line, key: `cta-${blocks.length}` });
      continue;
    }
    paragraphBuffer.push(line);
  }
  flushParagraph();
  return blocks;
}

export default function DraftStudioPage() {
  const navigate = useNavigate();
  const { keywords } = useKeywords();
  const { isGenerating, streamedContent, error: generateError, progress, stageLabel, startGenerate } = useBlogGenerate();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => loadSelectedKeywordIds());
  const [clinicName, setClinicName] = useState("セイェクリニック");
  const [tone, setTone] = useState("신뢰감 있는 전문 톤");
  const [speaker, setSpeaker] = useState("none");
  const [customInstruction, setCustomInstruction] = useState("");
  const [llmProvider, setLlmProvider] = useState<"gemini" | "claude">("gemini");
  const [apiKey, setApiKey] = useState(
    () => window.localStorage.getItem(`${API_KEY_STORAGE_PREFIX}gemini`) ?? ""
  );
  const [intentSegment, setIntentSegment] = useState<"auto" | "hero" | "hub" | "hygiene">("auto");
  const [modelMode, setModelMode] = useState<"fast" | "balanced" | "quality">("fast");
  const [requestSpeed, setRequestSpeed] = useState<"relaxed" | "standard" | "priority">("relaxed");
  const [manualKeyword, setManualKeyword] = useState("");
  const [manualRelatedKeywordsText, setManualRelatedKeywordsText] = useState("");
  const [savedBlogId, setSavedBlogId] = useState("");
  const [copyLabel, setCopyLabel] = useState("초안 복사");
  const [copyHtmlLabel, setCopyHtmlLabel] = useState("HTML 복사");
  const [showPromptGuide, setShowPromptGuide] = useState(false);

  useEffect(() => {
    if (keywords.length === 0) return;
    const validIds = new Set(keywords.map((kw) => kw.id));
    const stored = loadSelectedKeywordIds();
    setSelectedIds(stored.filter((id) => validIds.has(id)));
  }, [keywords]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`${API_KEY_STORAGE_PREFIX}${llmProvider}`) ?? "";
      setApiKey(stored);
    } catch {
      setApiKey("");
    }
  }, [llmProvider]);

  useEffect(() => {
    try {
      if (apiKey.trim()) {
        window.localStorage.setItem(`${API_KEY_STORAGE_PREFIX}${llmProvider}`, apiKey);
      } else {
        window.localStorage.removeItem(`${API_KEY_STORAGE_PREFIX}${llmProvider}`);
      }
    } catch {
      // Ignore storage failures and keep the form usable.
    }
  }, [apiKey, llmProvider]);

  const selectedKeywords = useMemo(() => keywords.filter((item) => selectedIds.includes(item.id)), [keywords, selectedIds]);
  const selectedKeywordPreview = useMemo(() => {
    const visible = selectedKeywords.slice(0, 2);
    return { visible, hiddenCount: Math.max(0, selectedKeywords.length - visible.length) };
  }, [selectedKeywords]);
  const parsedDraft = useMemo(() => parseDraftStructure(streamedContent), [streamedContent]);
  const articleBlocks = useMemo(() => renderArticleNodes(parsedDraft.articleBody), [parsedDraft.articleBody]);

  const handleCopyDraft = async () => {
    if (!streamedContent.trim()) return;
    try {
      await navigator.clipboard.writeText(streamedContent);
      setCopyLabel("복사 완료");
      window.setTimeout(() => setCopyLabel("초안 복사"), 1800);
    } catch {
      setCopyLabel("복사 실패");
      window.setTimeout(() => setCopyLabel("초안 복사"), 1800);
    }
  };

  const handleCopyHtml = async () => {
    if (!parsedDraft.articleBody.trim()) return;
    const html = renderArticleHtml(parsedDraft.articleTitle || "제목 없음", parsedDraft.articleBody);
    try {
      if ("ClipboardItem" in window) {
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([parsedDraft.articleBody], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(parsedDraft.articleBody);
      }
      setCopyHtmlLabel("HTML 복사 완료");
      window.setTimeout(() => setCopyHtmlLabel("HTML 복사"), 1800);
    } catch {
      setCopyHtmlLabel("HTML 복사 실패");
      window.setTimeout(() => setCopyHtmlLabel("HTML 복사"), 1800);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={sectionStyle}>
        <header style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#e11d48" }}>3단계 · 원고 생성</div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.04 }}>선택 키워드로 원고 작성</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 16 }}>
            선정한 키워드를 기반으로 Google Gemini 또는 Claude 초안을 생성하고, 저장된 초안은 바로 편집기로 넘길 수 있습니다.
          </p>
        </header>

        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <strong style={{ display: "block", fontSize: 20 }}>현재 선택된 키워드</strong>
              <span style={{ color: "#64748b", fontSize: 14 }}>{selectedKeywords.length}개가 이번 배치 원고 대상으로 넘어와 있습니다.</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to="/workflow/select" style={ghostLinkStyle}>선정 단계로 돌아가기</Link>
              {savedBlogId ? (
                <button type="button" onClick={() => navigate(`/blog/${savedBlogId}`)} style={ctaButtonStyle}>
                  저장된 초안 편집으로 이동
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {selectedKeywords.length > 0 ? (
              <div style={keywordSummaryStyle}>
                {selectedKeywordPreview.visible.map((item) => (
                  <div key={item.id} style={keywordChipStyle}>
                    <strong>{item.keyword}</strong>
                    <span style={{ color: "#64748b", fontSize: 12 }}>한글 해석: {translateKeywordToKorean(item.keyword)}</span>
                  </div>
                ))}
                {selectedKeywordPreview.hiddenCount > 0 ? <div style={keywordMoreChipStyle}>+{selectedKeywordPreview.hiddenCount}개</div> : null}
              </div>
            ) : null}
            {selectedKeywords.length === 0 ? (
              <div style={{ padding: "14px 16px", borderRadius: 16, background: "#fff7ed", color: "#9a3412" }}>
                아직 선정된 키워드가 없습니다. 그래도 아래에서 직접 타깃 키워드를 입력하면 바로 원고를 생성할 수 있습니다.
              </div>
            ) : null}
          </div>
        </section>

        <section style={{ ...panelStyle, padding: 0, overflow: "hidden" }}>
          <div style={splitLayoutStyle}>
            <div style={leftPaneStyle}>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={fieldStyle}>
              생성 API
              <select value={llmProvider} onChange={(e) => setLlmProvider(e.target.value as "gemini" | "claude")} style={inputStyle}>
                <option value="gemini">Google Gemini</option>
                <option value="claude">Claude</option>
              </select>
            </label>
            <label style={fieldStyle}>
              {llmProvider === "claude" ? "Claude API Key" : "Gemini API Key"}
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={inputStyle} />
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
            <label style={fieldStyle}>
              생성 모드
              <select value={modelMode} onChange={(e) => setModelMode(e.target.value as typeof modelMode)} style={inputStyle}>
                <option value="fast">빠른 초안 (Flash 우선)</option>
                <option value="balanced">균형형 (Flash 후 Pro 보강)</option>
                <option value="quality">고품질 (Pro 우선)</option>
              </select>
            </label>
            <label style={fieldStyle}>
              호출 속도
              <select value={requestSpeed} onChange={(e) => setRequestSpeed(e.target.value as typeof requestSpeed)} style={inputStyle}>
                <option value="relaxed">절약 모드 (천천히, 쿼터 우선)</option>
                <option value="standard">기본 모드</option>
                <option value="priority">응답 우선 (빠르게 시도)</option>
              </select>
            </label>
            <label style={fieldStyle}>
              콘텐츠 전략
              <select value={intentSegment} onChange={(e) => setIntentSegment(e.target.value as typeof intentSegment)} style={inputStyle}>
                <option value="auto">자동 (키워드 기반)</option>
                <option value="hero">Hero (고전환/강CTA)</option>
                <option value="hub">Hub (비교/의사결정)</option>
                <option value="hygiene">Hygiene (정보/신뢰)</option>
              </select>
            </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={fieldStyle}>
              직접 입력 타깃 키워드
              <input
                value={manualKeyword}
                onChange={(e) => setManualKeyword(e.target.value)}
                style={inputStyle}
                placeholder="선택 키워드가 없을 때 예: 江南 ウルセラ おすすめ"
              />
            </label>
                </div>

                <label style={fieldStyle}>
                  직접 입력 관련 키워드
                  <textarea
                    value={manualRelatedKeywordsText}
                    onChange={(e) => setManualRelatedKeywordsText(e.target.value)}
                    style={{ ...inputStyle, minHeight: 88, resize: "vertical" }}
                    placeholder="줄바꿈 또는 쉼표로 입력하세요. 예: 韓国 ウルセラ, ソウル ウルセラ 料金, HIFU 江南"
                  />
                </label>

                <label style={fieldStyle}>
                  직접 입력 조정
                  <textarea
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    style={{ ...inputStyle, minHeight: 150, resize: "vertical" }}
                    placeholder="예: 일본 독자가 불안해하는 포인트를 먼저 짚고, 상담 동선과 가격 가이드를 더 친절하게 설명해 주세요."
                  />
                </label>

                <div style={{ color: "#64748b", fontSize: 14 }}>
                  기본 클리닉명은 <strong>セイェクリニック</strong>이며, 생성 API는 <strong>{llmProvider === "claude" ? "Claude" : "Google Gemini"}</strong>입니다. 키워드를 고르지 않아도 직접 입력으로 생성할 수 있습니다. {llmProvider === "gemini" ? "무료 Gemini 키라면 절약 모드가 가장 안정적입니다." : "Claude는 호출 속도보다는 모델 품질 설정의 영향이 더 큽니다."}
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <button type="button" onClick={() => setShowPromptGuide((value) => !value)} style={promptGuideButtonStyle}>
                    기본 프롬프트 지침 {showPromptGuide ? "접기" : "보기"}
                  </button>
                  {showPromptGuide ? (
                    <div style={promptGuidePanelStyle}>
                      <div style={promptGuideTitleStyle}>현재 기본 지침</div>
                      <div style={promptGuideGridStyle}>
                        <div style={promptGuideCardStyle}>
                          <strong>원고 구조</strong>
                          <span>SEO, 슬러그, 한국어 메모, 본문, IMAGE_SLOT, CTA_BANNER, META까지 완결형으로 생성합니다.</span>
                        </div>
                        <div style={promptGuideCardStyle}>
                          <strong>분량 기준</strong>
                          <span>3,000~4,500자, H2 4~5개, FAQ 3개 이상, CTA 2회 이상을 목표로 합니다.</span>
                        </div>
                        <div style={promptGuideCardStyle}>
                          <strong>SEO / GEO</strong>
                          <span>도입부 선결론, 변형 키워드 사용, 지역어 분산, FAQ와 요약 구조를 함께 반영합니다.</span>
                        </div>
                        <div style={promptGuideCardStyle}>
                          <strong>슬러그 규칙</strong>
                          <span>시술-주된주제-주제상세-지역 형태의 4단 구조를 추천합니다.</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <GenerateButton
                  disabled={(!selectedKeywords.length && !manualKeyword.trim()) || !apiKey}
                  isGenerating={isGenerating}
                  onClick={() =>
                    void startGenerate({
                      keywordIds: selectedIds,
                      clinicName,
                      tone,
                      speaker,
                      customInstruction,
                      llmProvider,
                      apiKey,
                      modelMode,
                      requestSpeed,
                      manualKeyword,
                      manualRelatedKeywords: manualRelatedKeywordsText
                        .split(/\n|,/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                      intentSegment,
                    })
                      .then((blogId) => {
                        if (blogId) {
                          setSavedBlogId(blogId);
                          void syncInventory().catch(() => undefined);
                        }
                      })
                      .catch(() => undefined)
                  }
                />
              </div>
            </div>

            <div style={rightPaneStyle}>
              <div style={{ display: "grid", gap: 12 }}>
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
                {generateError ? <div style={errorStyle}>{generateError}</div> : null}
              </div>

              <div style={draftBoxStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <strong style={{ display: "block", fontSize: 17 }}>생성 중 초안 미리보기</strong>
                    <span style={{ color: "#cbd5e1", fontSize: 13 }}>저장되기 전 초안을 여기서 바로 확인합니다.</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ color: "#cbd5e1", fontSize: 13 }}>{streamedContent ? "실시간 반영 중" : "아직 생성된 초안이 없습니다."}</div>
                    <button type="button" onClick={() => void handleCopyDraft()} style={copyButtonStyle} disabled={!streamedContent.trim()}>
                      {copyLabel}
                    </button>
                    <button type="button" onClick={() => void handleCopyHtml()} style={copyButtonStyle} disabled={!parsedDraft.articleBody.trim()}>
                      {copyHtmlLabel}
                    </button>
                  </div>
                </div>
                {streamedContent ? (
                  <div style={resultLayoutStyle}>
                    <div style={metaRowStyle}>
                      <div style={metaCardStyle}>
                        <strong style={metaCardTitleStyle}>SEO</strong>
                        <div style={metaItemStyle}><span style={metaLabelStyle}>Title</span><div>{renderInlineNodes(parsedDraft.seoTitle || "생성 중...")}</div></div>
                        <div style={metaItemStyle}><span style={metaLabelStyle}>Meta Image</span><div>{renderInlineNodes(parsedDraft.metaImage || "생성 중...")}</div></div>
                        <div style={metaItemStyle}><span style={metaLabelStyle}>Description</span><div>{renderInlineNodes(parsedDraft.description || "생성 중...")}</div></div>
                      </div>
                      <div style={metaCardStyle}>
                        <strong style={metaCardTitleStyle}>SLUG</strong>
                        <div style={{ wordBreak: "break-all" }}>{renderInlineNodes(parsedDraft.slug || "생성 중...")}</div>
                      </div>
                      <div style={metaCardStyle}>
                        <strong style={metaCardTitleStyle}>한국어 확인 메모</strong>
                        <div style={{ display: "grid", gap: 8 }}>
                          {parsedDraft.koreanMemo.length ? parsedDraft.koreanMemo.map((line) => (
                            <div key={line} style={{ color: "#cbd5e1" }}>{renderInlineNodes(line)}</div>
                          )) : <div style={{ color: "#94a3b8" }}>생성 중...</div>}
                        </div>
                      </div>
                    </div>
                    <article style={articlePreviewStyle}>
                      <h1 style={articleTitleStyle}>{renderInlineNodes(parsedDraft.articleTitle || "제목 생성 중...")}</h1>
                      <div style={{ display: "grid", gap: 16 }}>
                        {articleBlocks.length ? articleBlocks.map((block) => {
                          if (block.type === "h2") return <h2 key={block.key} style={h2Style}>{renderInlineNodes(block.value)}</h2>;
                          if (block.type === "h3") return <h3 key={block.key} style={h3Style}>{renderInlineNodes(block.value)}</h3>;
                          if (block.type === "li") return <li key={block.key} style={liStyle}>{renderInlineNodes(block.value)}</li>;
                          if (block.type === "image-slot") return <div key={block.key} style={imageSlotStyle}>{renderInlineNodes(block.value)}</div>;
                          if (block.type === "cta-slot") return <div key={block.key} style={ctaSlotStyle}>{renderInlineNodes(block.value)}</div>;
                          return <p key={block.key} style={paragraphStyle}>{renderInlineNodes(block.value)}</p>;
                        }) : <div style={{ color: "#94a3b8" }}>원고 생성 중...</div>}
                      </div>
                    </article>
                  </div>
                ) : (
                  <div style={{ minHeight: 720, display: "grid", placeItems: "center", color: "#cbd5e1" }}>
                    원고 생성을 시작하면 초안이 이 영역에 쌓입니다.
                  </div>
                )}
              </div>
            </div>
          </div>
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

const splitLayoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 0.66fr) minmax(0, 1.84fr)",
  gap: 0,
};

const leftPaneStyle: CSSProperties = {
  padding: 22,
  borderRight: "1px solid rgba(148, 163, 184, 0.18)",
  background: "rgba(255,255,255,0.78)",
};

const rightPaneStyle: CSSProperties = {
  padding: "22px 28px",
  display: "grid",
  alignContent: "start",
  gap: 16,
  background: "linear-gradient(180deg, rgba(15,23,42,0.02), rgba(131,58,180,0.05))",
  minWidth: 0,
};

const keywordSummaryStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const keywordChipStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 18,
  background: "#fff",
  border: "1px solid #eef2f7",
  maxWidth: 280,
};

const keywordMoreChipStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  padding: "10px 14px",
  borderRadius: 999,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  color: "#475569",
  fontSize: 13,
  fontWeight: 700,
  alignSelf: "center",
};

const copyButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
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

const ctaButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "12px 18px",
  background: "linear-gradient(135deg, #833ab4, #fd1d1d 55%, #fcb045)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

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

const errorStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  fontSize: 14,
};

const draftBoxStyle: CSSProperties = {
  padding: "20px 24px",
  borderRadius: 20,
  background: "linear-gradient(135deg, #1f2937, #111827 56%, #312e81)",
  color: "#f9fafb",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.16)",
  overflowX: "hidden",
  overflowY: "visible",
};

const resultLayoutStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  marginTop: 12,
  minWidth: 0,
};

const metaRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
  minWidth: 0,
  alignItems: "stretch",
};

const metaCardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 16,
  borderRadius: 16,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  alignContent: "start",
  minWidth: 0,
  overflowWrap: "anywhere",
};

const metaCardTitleStyle: CSSProperties = {
  fontSize: 15,
  color: "#f8fafc",
};

const metaItemStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#e2e8f0",
  fontSize: 14,
};

const metaLabelStyle: CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94a3b8",
};

const articlePreviewStyle: CSSProperties = {
  padding: "28px 32px",
  borderRadius: 18,
  background: "#fff",
  color: "#0f172a",
  minHeight: 860,
  maxHeight: "calc(100vh - 220px)",
  overflow: "auto",
  boxShadow: "inset 0 0 0 1px rgba(226,232,240,0.8)",
  width: "100%",
  boxSizing: "border-box",
  minWidth: 0,
  overflowX: "hidden",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

const articleTitleStyle: CSSProperties = {
  margin: "0 0 18px",
  fontSize: 36,
  lineHeight: 1.16,
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
};

const paragraphStyle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  lineHeight: 1.85,
  color: "#334155",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
};

const h2Style: CSSProperties = {
  margin: "12px 0 0",
  fontSize: 28,
  lineHeight: 1.35,
  color: "#0f172a",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
};

const h3Style: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 22,
  lineHeight: 1.4,
  color: "#1e293b",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
};

const liStyle: CSSProperties = {
  marginLeft: 20,
  color: "#334155",
  lineHeight: 1.8,
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

const imageSlotStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 700,
};

const ctaSlotStyle: CSSProperties = {
  padding: "16px 18px",
  borderRadius: 16,
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#9f1239",
  fontWeight: 800,
};

const promptGuideButtonStyle: CSSProperties = {
  justifySelf: "start",
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#334155",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const promptGuidePanelStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const promptGuideTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#0f172a",
};

const promptGuideGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const promptGuideCardStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 12,
  borderRadius: 14,
  background: "#fff",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
};
