//frontend/src/components/S_App.tsx

import { useEffect, useState } from "react";
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

const IOS_BLUE = "#0074B7";

export default function StudentApp() {
  const navigate = useNavigate();
  const token = localStorage.getItem("coop.token");

  const [profile, setProfile] = useState<StudentProfile | null>(null);

  // ---------- ดึงข้อมูลจาก backend ----------

  useEffect(() => {
    if (!token) {
      navigate("/", { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return;

    const fetchProfile = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/students/me", {
          headers: { Authorization: `Bearer ${token}` },
        });


        const data = await res.json();

        // map studentId จาก user.email หากยังไม่มี studentId
        const studentId = data.studentId || data.user?.email || "";

        // เตรียม emails
        const emails = [
          data.emails?.[0] ?? { email: "", primary: true },
          data.emails?.[1] ?? { email: "", primary: false },
        ];

        // map coop.company + mentor
        const company = data.coop ? { ...data.coop.company, mentor: data.coop.mentor } : undefined;

        setProfile({ ...data, studentId, emails, company });
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };

    fetchProfile();
  }, [token]);

  if (!profile) return <div>กำลังโหลดข้อมูล...</div>;

  const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
  const displayName = profile.studentId || fullName || "นักศึกษา";

  function onLogout() {
    localStorage.removeItem("coop.token");
    localStorage.removeItem("coop.current.studentId");
    navigate("/", { replace: true });
  }

  return (
    <div className="app-bg">
      {/* ---------- Topbar ---------- */}
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
            aria-label={`ออกจากระบบ (${profile.studentId || ""})`}
            title="ออกจากระบบ"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      {/* ---------- Layout ---------- */}
      <div className="layout">
        <Sidebar profile={profile} />

        <main className="main">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="gateway" element={<Gateway profile={profile} setProfile={setProfile} />} />
            <Route path="daily" element={<DailyPage profile={profile} />} />
            <Route path="docs" element={<DocPage profile={profile} setProfile={setProfile} />} />
            <Route path="company" element={<Company profile={profile} setProfile={setProfile} />} />
            <Route path="docs-t002" element={<DocT002 profile={profile} />} />
            <Route path="docs-t003" element={<DocT003 profile={profile} />} />
            <Route path="supervision" element={<S_Supervision profile={profile} />} />
            <Route path="status-tracker" element={<StatusTraker profile={profile} />} />
            <Route path="doc-t005-006" element={<S_DocT005_006 profile={profile} />} />
            <Route path="doc-t007" element={<S_DocT007 profile={profile} />} />
            <Route path="doc-t008" element={<S_DocT008 profile={profile} />} />

            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <StudentTheme IOS_BLUE={IOS_BLUE} />

      {/* ---------- CSS ---------- */}
      <style>{`
        .topbar{
          position: sticky;
          top: 0;
          z-index: 10;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:16px;
          padding:10px 16px;
          background:#fff;
          border-bottom:1px solid rgba(0,0,0,.06);
        }
        .brand-badge{
          display:flex; align-items:center; justify-content:center;
          background:#E6F0FF; border-radius:14px; padding:2px;
          border:1px solid rgba(0,0,0,.05);
        }
        .brand-img{ height:40px; width:auto; }

        .topbar-right{ display:flex; align-items:center; gap:12px; }
        .user-mini{ display:flex; align-items:center; gap:10px; }
        .user-ava{ width:28px; height:28px; border-radius:50%; background:#cfe4ff; }
        .user-name{ font-weight:700; }

        .btn-ico{
          width:38px; height:38px;
          display:inline-flex; align-items:center; justify-content:center;
          border-radius:10px; border:1px solid rgba(0,0,0,.08);
          background:#fff; color:#0f172a; cursor:pointer;
          transition:.12s;
        }
        .btn-ico:hover{
          background:#f8fafc;
          border-color:#c7d2fe;
          color:${IOS_BLUE};
          box-shadow:0 2px 10px rgba(0,116,183,.14);
        }
        .btn-ico svg{ width:20px; height:20px; }
      `}</style>
    </div>
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
    >
      <path d="M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
      <path d="M16 12H8" />
      <path d="M19 12l-3-3" />
      <path d="M19 12l-3 3" />
    </svg>
  );
}
