import type { CSSProperties } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import BlogEditor from "./pages/BlogEditor";
import DraftStudioPage from "./pages/DraftStudioPage";
import KeywordFetchPage from "./pages/KeywordFetchPage";
import KeywordSelectPage from "./pages/KeywordSelectPage";
import OverviewDashboardPage from "./pages/OverviewDashboardPage";
import GapAnalysisPage from "./pages/GapAnalysisPage";
import Settings from "./pages/Settings";

const navStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  padding: "16px 24px",
  borderBottom: "1px solid #e5e7eb",
  background: "#fff",
  position: "sticky",
  top: 0,
};

export default function App() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <div>
      <nav style={navStyle}>
        <NavLinkItem to="/workflow/fetch" label="키워드 수집" active={isActive("/workflow/fetch")} />
        <NavLinkItem to="/workflow/gap" label="갭 분석" active={isActive("/workflow/gap")} />
        <NavLinkItem to="/workflow/select" label="키워드 선정" active={isActive("/workflow/select")} />
        <NavLinkItem to="/workflow/draft" label="원고 생성" active={isActive("/workflow/draft")} />
        <NavLinkItem to="/dashboard" label="대시보드" active={isActive("/dashboard")} />
        <Link to="/settings">Settings</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/workflow/fetch" replace />} />
        <Route path="/workflow/fetch" element={<KeywordFetchPage />} />
        <Route path="/workflow/gap" element={<GapAnalysisPage />} />
        <Route path="/workflow/select" element={<KeywordSelectPage />} />
        <Route path="/workflow/draft" element={<DraftStudioPage />} />
        <Route path="/dashboard" element={<OverviewDashboardPage />} />
        <Route path="/blog/:id" element={<BlogEditor />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
}

function NavLinkItem({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: active ? "#e11d48" : "#475569",
        fontWeight: 800,
      }}
    >
      {label}
    </Link>
  );
}
