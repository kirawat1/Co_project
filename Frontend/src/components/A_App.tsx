import { useEffect, useState } from "react";
import { ThemeToggleBtn } from "./ThemeContext";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Sidebar from "./A_Sidebar";
import Dashboard from "./A_Dashboard";
import Students from "./A_Students";
import Mentors from "./A_Mentors";
import Docs from "./A_Docs";
import Daily from "./A_Daily";
import Announcements from "./A_Announcements";
import Settings from "./A_Settings";
import StudentTheme from "./S_Theme";         // ใช้ธีมเดียว
import coopLogo from "../assets/COOP_Logo.png";
import Teachers from "./A_Teacher";
import Companies from "./A_Company";
import StaffCriteriaPage from "./A_CriteriaPage";
import DocT000 from "./A_DocT000";
import DocT002 from "./A_DocT002Review";
import DocT003 from "./A_DocT003Review";
import Coopperiod from "./A_CoopPeriod";
import CoopApplications from "./A_CoopApplications";
import A_DocRequirements from "./A_DocRequirements";
import A_SupervisionManager from "./A_SupervisionManage";
import A_DocT005_006 from "./A_DocT005_006";
import A_DocT007 from "./A_DocT007";
import A_DocT008 from "./A_DocT008";


const IOS_BLUE = "#0074B7";

type AdminProfile = {
  id: number;
  email: string;
  role: string;
};


export default function AdminApp() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);


  const displayName = profile?.email || "เจ้าหน้าที่";

  useEffect(() => {
    const token = localStorage.getItem("coop.token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        if (!data.ok) throw new Error();
        setProfile(data.user);
      })
      .catch(() => {
        localStorage.removeItem("coop.token");
        navigate("/", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  function onLogout() {
    localStorage.removeItem("coop.token");
    navigate("/", { replace: true });
  }

  if (loading) {
    return <div style={{ padding: 24 }}>กำลังโหลด...</div>;
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
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main">
          <Routes>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="mentors" element={<Mentors />} />
            <Route path="company" element={<Companies />} />
            <Route path="docs" element={<Docs />} />
            <Route path="daily" element={<Daily />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="settings" element={<Settings />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="criteria" element={<StaffCriteriaPage />} />
            <Route path="doct000" element={<DocT000 />} />
            <Route path="doct002" element={<DocT002 />} />
            <Route path="doct003" element={<DocT003 />} />
            <Route path="coop-period" element={<Coopperiod />} />
            <Route path="coop-applications" element={<CoopApplications />} />
            <Route path="supervision-manager" element={<A_SupervisionManager />} />
            <Route path="doc-t005-006" element={<A_DocT005_006 />} />
            <Route path="doc-t007" element={<A_DocT007 />} />
            <Route path="doc-t008" element={<A_DocT008 />} />
            {/* ✅ ย้ายขึ้นมา และลบ /admin/ ออก */}
            <Route path="doc-requirements" element={<A_DocRequirements />} />

            {/* ✅ ใส่ /admin/ นำหน้า เพื่อป้องกัน Infinite Loop */}
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <StudentTheme IOS_BLUE={IOS_BLUE} />
    </div>
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

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
      <path d="M16 12H8" />
      <path d="M19 12l-3-3" />
      <path d="M19 12l-3 3" />
    </svg>
  );
}