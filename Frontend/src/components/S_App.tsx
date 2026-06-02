//frontend/src/components/S_App.tsx
import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Sidebar from "./S_Sidebar";
import DashboardPage from "./S_Dashboard";
import ProfilePage from "./S_ProfilePage";
import Gateway from "./S_Gateway";
import DailyPage from "./S_DailyPage";
import DocPage from "./S_Docs";
import Company from "./S_Company";
import StudentTheme from "./S_Theme";
import DocT002 from "./S_DocsT002Form";
import DocT003 from "./S_DocsT003Form";
import coopLogo from "../assets/COOP_Logo.png";
import S_Supervision from "./S_Supervision";
import StatusTraker from "./S_StatusTracker";
import { type StudentProfile } from "./store";
import S_DocT005_006 from "./S_DocT005_006";
import S_DocT007 from "./S_DocT007";
import S_DocT008 from './S_DocT008';
import S_Announcements from './S_Announcements';
import { ThemeToggleBtn } from "./ThemeContext";

const IOS_BLUE = "#0074B7";

export default function StudentApp() {
  const navigate = useNavigate();
  const token = localStorage.getItem("coop.token");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!token) navigate("/", { replace: true });
  }, [token, navigate]);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/students/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const studentId = data.studentId || data.user?.email || "";
      const emails = [
        data.emails?.[0] ?? { email: "", primary: true },
        data.emails?.[1] ?? { email: "", primary: false },
      ];
      const company = data.coop ? { ...data.coop.company, mentor: data.coop.mentor } : undefined;
      setProfile({ ...data, studentId, emails, company });
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  }, [token]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (!profile) return <div style={{ padding: 40, textAlign: "center" }}>กำลังโหลดข้อมูล...</div>;

  const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
  const displayName = profile.studentId || fullName || "นักศึกษา";

  function onLogout() {
    localStorage.removeItem("coop.token");
    localStorage.removeItem("coop.current.studentId");
    navigate("/", { replace: true });
  }

  return (
    <div className="app-bg">
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn-ico btn-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="เมนู">
            <HamburgerIcon />
          </button>
          <div className="brand-badge">
            <img src={coopLogo} alt="Co-op Logo" className="brand-img" />
          </div>
        </div>

        <div className="topbar-right">
          <div className="user-mini">
            <div className="user-ava" />
            <div className="user-name">{displayName}</div>
          </div>
          <ThemeToggleBtn />
          <button className="btn-ico" onClick={onLogout} aria-label="ออกจากระบบ" title="ออกจากระบบ">
            <LogoutIcon />
          </button>
        </div>
      </header>

      <div className="layout">
        <div className={`sidebar-overlay${sidebarOpen ? " open" : ""}`} onClick={() => setSidebarOpen(false)} />
        <Sidebar profile={profile} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="main">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="gateway" element={<Gateway />} />
            <Route path="daily" element={<DailyPage profile={profile} />} />
            <Route path="docs" element={<DocPage profile={profile} setProfile={setProfile as any} />} />
            <Route path="company" element={<Company profile={profile} />} />
            <Route path="announcements" element={<S_Announcements />} />
            <Route path="docs-t002" element={<DocT002 profile={profile} onRefresh={fetchProfile} />} />
            <Route path="docs-t003" element={<DocT003 profile={profile} onRefresh={fetchProfile} />} />
            <Route path="supervision" element={<S_Supervision />} />
            <Route path="status-tracker" element={<StatusTraker status={profile?.coop?.status || "NOT_SUBMITTED"} />} />
            <Route path="doc-t005-006" element={<S_DocT005_006 />} />
            <Route path="doc-t007" element={<S_DocT007 />} />
            <Route path="doc-t008" element={<S_DocT008 />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <StudentTheme IOS_BLUE={IOS_BLUE} />
    </div>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
      <path d="M16 12H8" /><path d="M19 12l-3-3" /><path d="M19 12l-3 3" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
