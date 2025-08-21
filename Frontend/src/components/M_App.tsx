// src/components/M_App.tsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import M_Sidebar    from "./M_Sidebar";
import M_Dashboard  from "./M_Dashboard";
import M_Students   from "./M_Students";
import M_Daily      from "./M_Daily";
import M_Profile    from "./M_Profile";

import S_Theme from "./S_Theme";            // ใช้ธีมเดียวกับ Student
import coopLogo from "../assets/COOP_Logo.png";

export default function M_App() {
  const navigate = useNavigate();
  const IOS_BLUE = "#0074B7";

  const [displayName, setDisplayName] = useState<string>("พี่เลี้ยง");
  useEffect(() => {
    const fromProfile = (() => {
      try {
        const p = JSON.parse(localStorage.getItem("coop.mentor.profile") || "{}");
        const n = `${p.firstName || ""} ${p.lastName || ""}`.trim();
        return n || undefined;
      } catch { return undefined; }
    })();

    const name =
      localStorage.getItem("coop.mentor.displayName")?.trim() ||
      fromProfile ||
      "พี่เลี้ยง";
    setDisplayName(name);
  }, []);

  function onLogout() {
    localStorage.removeItem("coop.token");
    navigate("/", { replace: true });
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
          <button className="btn-ico" onClick={onLogout} aria-label="ออกจากระบบ" title="ออกจากระบบ">
            <LogoutIcon />
          </button>
        </div>
      </header>

      {/* Layout (เหมือน S_App) */}
      <div className="layout">
        <M_Sidebar />
        <main className="main">
          <Routes>
            {/* absolute redirect */}
            <Route index element={<Navigate to="/mentor/dashboard" replace />} />
            <Route path="dashboard" element={<M_Dashboard />} />
            <Route path="students"  element={<M_Students />} />
            <Route path="daily"     element={<M_Daily />} />
            <Route path="profile"   element={<M_Profile />} />
            <Route path="*"         element={<Navigate to="/mentor/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* ใช้ธีมเดียวกับนักศึกษา */}
      <S_Theme IOS_BLUE={IOS_BLUE} />

      {/* ปุ่มไอคอนบน Topbar (ชุดเดียวกับ S_App) */}
      <style>{`
        .topbar{ 
          position:sticky; top:0; z-index:10; 
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
          transition: background .12s, border-color .12s, box-shadow .12s, color .12s; 
        }
        .btn-ico:hover{ 
          background:#f8fafc; border-color:#c7d2fe; color:#0074B7; 
          box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14); 
        }
        .btn-ico svg{ width:20px; height:20px; display:block; }
      `}</style>
    </div>
  );
}

function LogoutIcon(){
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
      <path d="M16 12H8" />
      <path d="M19 12l-3-3" />
      <path d="M19 12l-3 3" />
    </svg>
  );
}
