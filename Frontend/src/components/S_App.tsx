// src/components/S_App.tsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import DashboardPage from "./Dashboard";
import ProfilePage from "./ProfilePage";
import CoopPage from "./CoopPage";
import DailyPage from "./DailyPage";
import { loadProfile, saveProfile, type StudentProfile } from "./store";
import StudentTheme from "./S_Theme";
import coopLogo from "../assets/COOP_Logo.png";

const IOS_BLUE = "#0074B7";

export default function StudentApp() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<StudentProfile>(() => loadProfile());
  useEffect(() => { saveProfile(profile); }, [profile]);

  // ✅ แสดง "รหัสนักศึกษา" ก่อนเสมอ → ถ้าไม่มีค่อยใช้ชื่อ-นามสกุล → สุดท้ายค่อย "นักศึกษา"
  const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
  const displayName = profile.studentId || fullName || "นักศึกษา"; // <-- แก้

  function onLogout() {
    window.localStorage?.removeItem("coop.token");
    navigate("/", { replace: true });
  }

  return (
    <div className="app-bg">
      {/* Topbar */}
      <header className="topbar">
        <div className="brand-badge">
          <img src={coopLogo} alt="Co-op Logo" className="brand-img" />
        </div>

        <div className="topbar-right">
          <div className="user-mini">
            <div className="user-ava" />
            <div className="user-name">{displayName}</div>
          </div>
          {/* ปุ่มไอคอนออกจากระบบ + บอกเลขนักศึกษาด้วย */}
          <button
            className="btn-ico"
            onClick={onLogout}
            aria-label={`ออกจากระบบ (${profile.studentId || "ไม่ทราบรหัส"})`} // <-- แก้
            title={profile.studentId || "ออกจากระบบ"}                             // <-- แก้
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
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="/" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage profile={profile} />} />
            <Route path="profile"   element={<ProfilePage  profile={profile} setProfile={setProfile} />} />
            <Route path="coop"      element={<CoopPage     profile={profile} setProfile={setProfile} />} />
            <Route path="daily"     element={<DailyPage    profile={profile} />} />
            <Route path="*"         element={<Navigate to="dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* ธีมหลัก */}
      <StudentTheme IOS_BLUE={IOS_BLUE} />

      {/* สไตล์เฉพาะ Topbar/โลโก้/ปุ่มไอคอน */}
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

/* ไอคอนออกจากระบบแบบมินิมอล */
function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
      <path d="M16 12H8" />
      <path d="M19 12l-3-3" />
      <path d="M19 12l-3 3" />
    </svg>
  );
}
