type GenerateButtonProps = {
  disabled: boolean;
  isGenerating: boolean;
  onClick: () => void;
};

export default function GenerateButton({ disabled, isGenerating, onClick }: GenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isGenerating}
      style={{
        border: "none",
        borderRadius: 999,
        padding: "14px 20px",
        fontWeight: 800,
        background: disabled || isGenerating ? "#cbd5e1" : "linear-gradient(135deg, #833ab4, #fd1d1d 55%, #fcb045)",
        color: "#fff",
        cursor: disabled || isGenerating ? "not-allowed" : "pointer",
        boxShadow: disabled || isGenerating ? "none" : "0 16px 40px rgba(253, 29, 29, 0.22)",
      }}
    >
      {isGenerating ? "원고 생성 중..." : "선택 키워드로 글 생성"}
    </button>
  );
}
