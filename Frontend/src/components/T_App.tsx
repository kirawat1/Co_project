import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import T_Sidebar from "./T_Sidebar";
import T_Dashboard from "./T_Dashboard";
import T_Students from "./T_Students";
import T_Docs from "./T_Docs";
import T_Profile from "./T_Profile";

import StudentTheme from "./S_Theme";     // ใช้ธีมเดียวกับ student/admin
import coopLogo from "../assets/COOP_Logo.png";

const IOS_BLUE = "#0074B7";

export default function TeacherApp() {
    const navigate = useNavigate();

    // ชื่ออาจารย์จาก localStorage (fallback เป็น "อาจารย์")
    const [displayName, setDisplayName] = useState<string>(() => {
        const n = localStorage.getItem("coop.teacher.displayName");
        if (n && n.trim()) return n;
        try {
            const p = JSON.parse(localStorage.getItem("coop.teacher.profile") || "{}");
            const full = `${p.firstName || ""} ${p.lastName || ""}`.trim();
            if (full) return full;
            if (p.email) return String(p.email);
        } catch { }
        return "อาจารย์";
    });

    useEffect(() => {
        const n = localStorage.getItem("coop.teacher.displayName");
        if (n) setDisplayName(n);
    }, []);

    function onLogout() {
        localStorage.removeItem("coop.token");
        // (ถ้าคุณเก็บบทบาทไว้) localStorage.removeItem("coop.role");
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
                <T_Sidebar />
                <main className="main">
                    <Routes>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<T_Dashboard />} />
                        <Route path="students" element={<T_Students />} />
                        <Route path="docs" element={<T_Docs />} />
                        <Route path="profile" element={<T_Profile />} />
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                </main>
            </div>

            {/* ธีมหลัก (สี/ปุ่ม/อินพุต ใช้ร่วมกับ Student/Admin) */}
            <StudentTheme IOS_BLUE={IOS_BLUE} />

            {/* สไตล์ Topbar/โลโก้/ปุ่มไอคอน */}
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
