import { useEffect, useState } from "react";
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


  const displayName = profile?.email || "เจ้าหน้าที่";

  useEffect(() => {
    const token = localStorage.getItem("coop.token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    fetch("http://localhost:5000/api/auth/me", {
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
      {/* Topbar (เหมือน S_App) */}
      <header className="topbar">
        <div className="brand-badge">
          <img src={coopLogo} alt="Co-op Logo" className="brand-img" />
        </div>

        <div className="topbar-right">
          <div className="user-mini">
            <div className="user-ava" />
            <div className="user-name">{displayName}</div>
          </div>
          <button
            className="btn-ico"
            onClick={onLogout}
            aria-label={`ออกจากระบบ (${displayName})`}
            title="ออกจากระบบ"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      {/* Layout */}
      <div className="layout">
        <Sidebar />
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

            {/* ✅ ย้ายขึ้นมา และลบ /admin/ ออก */}
            <Route path="doc-requirements" element={<A_DocRequirements />} />

            {/* ✅ ใส่ /admin/ นำหน้า เพื่อป้องกัน Infinite Loop */}
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* ธีมหลัก */}
      <StudentTheme IOS_BLUE={IOS_BLUE} />

      {/* สไตล์ Topbar/โลโก้/ปุ่มไอคอน (ยกมาจาก S_App) */}
      <style>{`
        .topbar{
          position: sticky; top: 0; z-index: 10;
          display:flex; align-items:center; justify-content:space-between;
          gap:16px; padding:10px 16px; background:#fff;
          border-bottom:1px solid rgba(0,0,0,.06);
        }
        .brand-badge{
          display:flex; align-items:center; justify-content:center;
          background:#E6F0FF; border-radius:14px; padding:2px 2px;
          border:1px solid rgba(0,0,0,.05);
        }
        .brand-img{ height:25px; width:auto; display:block; }
        @media (min-width:1024px){ .brand-img{ height:40px; } }

        .topbar-right{ display:flex; align-items:center; gap:12px; }
        .user-mini{ display:flex; align-items:center; gap:10px; }
        .user-ava{ width:28px; height:28px; border-radius:50%; background:#cfe4ff; }
        .user-name{ font-weight:700; }

        .btn-ico{
          width:38px; height:38px; display:inline-flex; align-items:center; justify-content:center;
          border-radius:10px; border:1px solid rgba(0,0,0,.08);
          background:#fff; color:#0f172a; cursor:pointer;
          transition: background .12s ease, border-color .12s ease, box-shadow .12s ease, color .12s ease;
        }
        .btn-ico:hover{
          background:#f8fafc; border-color:#c7d2fe; color:${IOS_BLUE};
          box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14);
        }
        .btn-ico svg{ width:20px; height:20px; display:block; }
      `}</style>
    </div>
  );
}

/* ไอคอนออกจากระบบ */
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