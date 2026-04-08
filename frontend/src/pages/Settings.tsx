export default function Settings() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, display: "grid", gap: 16 }}>
      <h1>Settings</h1>
      <section style={{ padding: 16, background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb" }}>
        <h3>v1 설정 방향</h3>
        <ul>
          <li>Google Ads 인증은 서버 보관형 서비스 계정 사용</li>
          <li>Gemini API 키는 각 사용자가 Dashboard에서 직접 입력</li>
          <li>스케줄은 백엔드 cron으로 관리</li>
          <li>Supabase 연결 전까지는 로컬 JSON fallback 사용</li>
        </ul>
      </section>
    </main>
  );
}
