import { useEffect, useState } from "react";

const DRAFT_STORAGE_KEY = "gkw:draft:streamedContent";

type GenerateArgs = {
  keywordIds: string[];
  clinicName: string;
  tone: string;
  speaker: string;
  customInstruction: string;
  llmProvider: "gemini" | "claude";
  apiKey: string;
  modelMode: "fast" | "balanced" | "quality";
  requestSpeed: "relaxed" | "standard" | "priority";
  manualKeyword: string;
  manualRelatedKeywords: string[];
  intentSegment: string;
};

function normalizeErrorMessage(value: unknown, fallback = "원고 생성 중 오류가 발생했습니다."): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Error && value.message.trim()) return value.message;
  if (Array.isArray(value)) {
    const parts: string[] = value
      .map((item): string => normalizeErrorMessage(item, ""))
      .filter(Boolean);
    return parts.length ? parts.join(" / ") : fallback;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) return record.message;
    if (typeof record.detail === "string" && record.detail.trim()) return record.detail;
    if (Array.isArray(record.detail)) {
      const detailText = record.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const loc = Array.isArray((item as Record<string, unknown>).loc)
              ? ((item as Record<string, unknown>).loc as unknown[]).join(" > ")
              : "";
            const msg = typeof (item as Record<string, unknown>).msg === "string" ? ((item as Record<string, unknown>).msg as string) : "";
            return [loc, msg].filter(Boolean).join(": ");
          }
          return "";
        })
        .filter(Boolean)
        .join(" / ");
      if (detailText) return detailText;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function useBlogGenerate() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedContent, setStreamedContent] = useState(
    () => window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? ""
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (streamedContent) {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, streamedContent);
    }
  }, [streamedContent]);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("대기 중");

  const startGenerate = async ({
    keywordIds,
    clinicName,
    tone,
    speaker,
    customInstruction,
    llmProvider,
    apiKey,
    modelMode,
    requestSpeed,
    manualKeyword,
    manualRelatedKeywords,
    intentSegment,
  }: GenerateArgs) => {
    setIsGenerating(true);
    setStreamedContent("");
    setError("");
    setProgress(10);
    setStageLabel("생성 요청 준비 중");

    let chunkCount = 0;
    let doneBlogId = "";

    try {
      const apiBase = import.meta.env.VITE_API_BASE || "http://127.0.0.1:3001";
      const response = await fetch(`${apiBase}/api/blog/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywordIds,
          language: "ja",
          tone,
          speaker,
          customInstruction,
          clinicName,
          llmProvider,
          apiKey,
          modelMode,
          requestSpeed,
          manualKeyword,
          manualRelatedKeywords,
          intentSegment,
        }),
      });

      if (!response.ok || !response.body) {
        let detail = "원고 생성 요청 실패";
        try {
          const payload = await response.json();
          detail = normalizeErrorMessage(payload.detail ?? payload.message ?? payload, detail);
        } catch {
          // no-op
        }
        setError(detail);
        setIsGenerating(false);
        setProgress(0);
        setStageLabel("요청 실패");
        throw new Error(detail);
      }

      setProgress(25);
      setStageLabel("AI 초안 생성 시작");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let sseBuffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const parts = sseBuffer.split("\n\n");
        // Keep the last (possibly incomplete) part in the buffer
        sseBuffer = parts.pop() ?? "";
        parts
          .filter(Boolean)
          .forEach((line) => {
            if (!line.startsWith("data: ")) return;
            let payload;
            try {
              payload = JSON.parse(line.replace("data: ", ""));
            } catch {
              return; // incomplete JSON chunk, skip
            }
            if (payload.type === "chunk") {
              chunkCount += 1;
              setStreamedContent((prev) => prev + payload.content);
              setProgress(Math.min(90, 25 + chunkCount * 6));
              setStageLabel("본문 생성 중");
            }
            if (payload.type === "error") {
              const message = normalizeErrorMessage(payload.message);
              setError(message);
              setProgress(0);
              setStageLabel("생성 중 오류");
              throw new Error(message);
            }
            if (payload.type === "done") {
              setProgress(100);
              setStageLabel("초안 생성 완료");
              doneBlogId = payload.blogId || "";
            }
          });
      }
    } catch (err) {
      const rawMessage =
        err instanceof TypeError
          ? "브라우저가 원고 생성 서버와 연결되지 않았습니다. 백엔드 실행 상태와 네트워크 연결을 확인해 주세요."
          : normalizeErrorMessage(err, "스트리밍 실패");
      const message = rawMessage.includes("429")
        ? `${llmProvider === "claude" ? "Claude" : "Gemini"} API 사용량이 잠시 초과되었습니다. 잠시 후 다시 시도하거나, 다른 API 키로 재시도해 주세요.`
        : rawMessage;
      setError(message);
      setStageLabel("생성 중 오류");
      throw err;
    } finally {
      setIsGenerating(false);
    }

    return doneBlogId;
  };

  return { isGenerating, streamedContent, error, progress, stageLabel, startGenerate };
}
