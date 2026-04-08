import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchBlogPost, updateBlogPost } from "../lib/api";
import type { BlogPost } from "../types";

export default function BlogEditor() {
  const { id } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    void fetchBlogPost(id)
      .then((row) => {
        setPost(row);
        setTitle(row.title ?? "");
        setContent(row.content ?? "");
        setStatus(row.status ?? "draft");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "원고를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaveMessage("");
    setError("");
    try {
      const result = await updateBlogPost(id, { title, content, status });
      setPost(result.post);
      setSaveMessage("저장 완료");
      window.setTimeout(() => setSaveMessage(""), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={containerStyle}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#7c3aed" }}>저장된 초안 편집</div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.08 }}>저장된 원고 수정하기</h1>
            <div style={{ color: "#64748b", fontSize: 15 }}>
              생성된 원고는 로컬 저장소 또는 Supabase에 보관되며, 여기서 다시 다듬어 배포 전 상태로 정리할 수 있습니다.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/workflow/draft" style={ghostLinkStyle}>원고 생성으로 돌아가기</Link>
            <button type="button" onClick={() => void handleSave()} style={saveButtonStyle} disabled={saving || loading || !post}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </header>

        {loading ? <div style={panelStyle}>원고를 불러오는 중입니다...</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        {!loading && post ? (
          <section style={editorLayoutStyle}>
            <aside style={metaPanelStyle}>
              <div style={metaCardStyle}>
                <strong style={metaTitleStyle}>원고 메타</strong>
                <div style={metaItemStyle}><span style={metaLabelStyle}>키워드</span><div>{post.keyword}</div></div>
                <div style={metaItemStyle}><span style={metaLabelStyle}>상태</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
                    <option value="draft">draft</option>
                    <option value="edited">edited</option>
                    <option value="published">published</option>
                  </select>
                </div>
                <div style={metaItemStyle}><span style={metaLabelStyle}>생성 시각</span><div>{post.created_at ?? "-"}</div></div>
                <div style={metaItemStyle}><span style={metaLabelStyle}>업데이트</span><div>{post.updated_at ?? "-"}</div></div>
                {saveMessage ? <div style={successStyle}>{saveMessage}</div> : null}
              </div>
              <div style={metaCardStyle}>
                <strong style={metaTitleStyle}>프롬프트 기록</strong>
                <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.7, wordBreak: "break-word" }}>
                  {post.prompt_used || "기록 없음"}
                </div>
              </div>
            </aside>

            <section style={editorPanelStyle}>
              <label style={fieldStyle}>
                제목
                <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                본문
                <textarea value={content} onChange={(e) => setContent(e.target.value)} style={textareaStyle} />
              </label>
            </section>
          </section>
        ) : null}
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(252,176,69,0.18), transparent 22%), radial-gradient(circle at top right, rgba(131,58,180,0.14), transparent 24%), linear-gradient(180deg, #fff7f3 0%, #fff 32%, #fff5f7 100%)",
};

const containerStyle: CSSProperties = {
  maxWidth: 1680,
  margin: "0 auto",
  padding: "24px 24px 48px",
  display: "grid",
  gap: 18,
};

const panelStyle: CSSProperties = {
  padding: 18,
  borderRadius: 20,
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
};

const editorLayoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(300px, 0.65fr) minmax(0, 1.35fr)",
  gap: 18,
};

const metaPanelStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const metaCardStyle: CSSProperties = {
  padding: 18,
  borderRadius: 22,
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
  display: "grid",
  gap: 12,
};

const metaTitleStyle: CSSProperties = {
  fontSize: 18,
  color: "#0f172a",
};

const metaItemStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#334155",
};

const metaLabelStyle: CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94a3b8",
};

const editorPanelStyle: CSSProperties = {
  padding: 22,
  borderRadius: 24,
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
  display: "grid",
  gap: 16,
  minWidth: 0,
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

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "70vh",
  resize: "vertical",
  fontFamily: "inherit",
  lineHeight: 1.8,
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  padding: "12px 14px",
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

const saveButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "12px 18px",
  background: "linear-gradient(135deg, #833ab4, #fd1d1d 55%, #fcb045)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const errorStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  fontSize: 14,
};

const successStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  background: "#ecfdf5",
  color: "#047857",
  border: "1px solid #a7f3d0",
  fontSize: 13,
  fontWeight: 700,
};
