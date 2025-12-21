// src/components/S_App.tsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Sidebar from "./S_Sidebar";
import DashboardPage from "./S_Dashboard";
import ProfilePage from "./S_ProfilePage";
import Gateway from "./S_Gateway";
import DailyPage from "./S_DailyPage";
import DocPage from "./S_Docs";

import { loadProfile, saveProfile, type StudentProfile } from "./store";
import StudentTheme from "./S_Theme";
import coopLogo from "../assets/COOP_Logo.png";

const IOS_BLUE = "#0074B7";

export default function StudentApp() {
  const navigate = useNavigate();

  // ใช้ studentId จาก token / mock login
  const studentIdFromToken =
    localStorage.getItem("coop.current.studentId") || "6400000000";

  // โหลดโปรไฟล์แบบ per-student
  const [profile, setProfile] = useState<StudentProfile>(() =>
    loadProfile(studentIdFromToken)
  );

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const fullName = `${profile.firstName || ""} ${
    profile.lastName || ""
  }`.trim();
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
        {/* Sidebar ฝั่งซ้าย */}
        <Sidebar profile={profile} />

        <main className="main">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            {/* dashboard ไม่ต้องรับ profile แล้ว */}
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route
              path="gateway"
              element={<Gateway profile={profile} setProfile={setProfile} />}
            />
            <Route path="daily" element={<DailyPage profile={profile} />} />
            <Route path="docs" element={<DocPage profile={profile} setProfile={setProfile} />} />
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
