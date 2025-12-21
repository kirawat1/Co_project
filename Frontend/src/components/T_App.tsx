import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import Sidebar from "./T_Sidebar";
import Dashboard from "./T_Dashboard";
import Requests from "./T_Requests";
import Students from "./T_Students";
import StudentDetail from "./T_StudentDetail";
import Exams from "./T_Exams";
import Profile from "./T_Profile";

import StudentTheme from "./S_Theme";
import coopLogo from "../assets/COOP_Logo.png";

const IOS_BLUE = "#0074B7";

export default function TeacherApp() {
  const navigate = useNavigate();

  /* =========================
     Display name (pattern เดียวกับ S_App)
  ========================= */
  const [displayName, setDisplayName] = useState<string>(() => {
    const n = localStorage.getItem("coop.teacher.displayName");
    if (n && n.trim()) return n;

    try {
      const p = JSON.parse(
        localStorage.getItem("coop.teacher.profile") || "{}"
      );
      const full = `${p.firstName || ""} ${p.lastName || ""}`.trim();
      if (full) return full;
      if (p.email) return String(p.email);
    } catch {
      /* ignore */
    }
    return "อาจารย์";
  });

  useEffect(() => {
    const n = localStorage.getItem("coop.teacher.displayName");
    if (n && n.trim()) setDisplayName(n);
  }, []);

  function onLogout() {
    localStorage.removeItem("coop.token");
    localStorage.removeItem("coop.teacher.id");
    navigate("/", { replace: true });
  }

  return (
    <div className="app-bg">
      {/* ---------- Topbar (เหมือน S_App) ---------- */}
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
            aria-label="ออกจากระบบ"
            title="ออกจากระบบ"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      {/* ---------- Layout (เหมือน S_App) ---------- */}
      <div className="layout">
        {/* Sidebar */}
        <Sidebar />

        <main className="main">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />

            <Route path="dashboard" element={<Dashboard />} />
            <Route path="requests" element={<Requests />} />

            <Route path="students" element={<Students />} />
            <Route
              path="students/:studentId"
              element={<StudentDetail />}
            />

            <Route path="exams" element={<Exams />} />
            <Route path="profile" element={<Profile />} />

            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* ---------- Theme (ใช้ชุดเดียวกับ Student) ---------- */}
      <StudentTheme IOS_BLUE={IOS_BLUE} />

      {/* ---------- CSS (copy จาก S_App) ---------- */}
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

/* =========================
   Icon (เหมือน S_App)
========================= */
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
