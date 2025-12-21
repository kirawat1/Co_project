import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import A_Sidebar from "./A_Sidebar";
import A_Dashboard from "./A_Dashboard";
import A_Students from "./A_Students";
import A_Mentors from "./A_Mentors";
import A_Docs from "./A_Docs";
import A_Daily from "./A_Daily";
import A_Announcements from "./A_Announcements";
import A_Settings from "./A_Settings";
import StudentTheme from "./S_Theme";         // ใช้ธีมเดียว
import coopLogo from "../assets/COOP_Logo.png";
import A_Teachers from "./A_Teacher";
import A_Companies from "./A_Company";

const IOS_BLUE = "#0074B7";

export default function AdminApp() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("กำลังโหลดข้อมูล...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("coop.token");
    console.log("Token from localStorage:", token); // 🔹 log token
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    async function fetchProfile() {
      try {
        console.log("Fetching /api/auth/me with token:", token);
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!data.ok) throw new Error(data.message || "ไม่สามารถโหลดข้อมูลผู้ใช้ได้");

        const user = data.user;
        const name = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;
        setDisplayName(name);

        // เก็บ cache เผื่อใช้เร็ว ๆ
        localStorage.setItem("coop.admin.displayName", name);
        localStorage.setItem("coop.admin.profile", JSON.stringify(user));
      } catch (err) {
        console.error(err);
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [navigate]);

  function onLogout() {
    localStorage.removeItem("coop.token");
    localStorage.removeItem("coop.admin.profile");
    localStorage.removeItem("coop.admin.displayName");
    navigate("/", { replace: true });
  }

  if (loading) return <div>กำลังโหลดข้อมูล...</div>;

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
        <A_Sidebar />
        <main className="main">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<A_Dashboard />} />
            <Route path="students" element={<A_Students />} />
            <Route path="mentors" element={<A_Mentors />} />
            <Route path="company" element={<A_Companies />} />
            <Route path="docs" element={<A_Docs />} />
            <Route path="daily" element={<A_Daily />} />
            <Route path="announcements" element={<A_Announcements />} />
            <Route path="settings" element={<A_Settings />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
            <Route path="teachers" element={<A_Teachers />} />
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
