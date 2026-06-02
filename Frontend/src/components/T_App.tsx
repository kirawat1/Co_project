import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ThemeToggleBtn } from "./ThemeContext";

import Sidebar from "./T_Sidebar";
import Dashboard from "./T_Dashboard";
import Requests from "./T_Requests";
import Students from "./T_Students";
import StudentDetail from "./T_StudentDetail";
import Exams from "./T_Exams";
import Profile from "./T_Profile";
import T_T002Review from "./T_T002Review";
import T_T003Review from "./T_T003Review";
import StudentTheme from "./S_Theme";
import coopLogo from "../assets/COOP_Logo.png";
import T_SupervisionReview from "./T_SupervisionReview";
import A_DocT005_006 from "./A_DocT005_006";
import A_DocT007 from "./A_DocT007";
import A_DocT008 from "./A_DocT008";
const IOS_BLUE = "#0074B7";

export default function TeacherApp() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCoopTeacher, setIsCoopTeacher] = useState(false);

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
    const token = localStorage.getItem("coop.token");

    // fetch ชื่อจาก API เสมอ เพื่อให้ได้ข้อมูลของ user ปัจจุบัน (ไม่ใช่ user เก่าที่ค้างใน localStorage)
    if (token) {
      fetch("/api/teacher/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.email || "อาจารย์";
            setDisplayName(name);
            localStorage.setItem("coop.teacher.displayName", name);
            setIsCoopTeacher(data.isCoopTeacher ?? false);
          }
        })
        .catch(() => {
          // fallback: ใช้ค่าจาก localStorage ถ้า fetch ไม่ได้
          const n = localStorage.getItem("coop.teacher.displayName");
          if (n && n.trim()) setDisplayName(n);
        });
    }

    // รับ event เมื่อ T_Profile บันทึกชื่อใหม่ในหน้าเดียวกัน
    const handler = (e: Event) => {
      const name = (e as CustomEvent<string>).detail;
      if (name) setDisplayName(name);
    };
    window.addEventListener("teacherNameUpdated", handler);
    return () => window.removeEventListener("teacherNameUpdated", handler);
  }, []);

  function onLogout() {
    // ลบ key ทั้งหมดที่เกี่ยวกับ teacher เพื่อไม่ให้ชื่อเก่าค้างข้ามการ login
    localStorage.removeItem("coop.token");
    localStorage.removeItem("coop.teacher.id");
    localStorage.removeItem("coop.teacher.displayName");
    localStorage.removeItem("coop.teacher.profile");
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
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />

            <Route path="dashboard" element={<Dashboard />} />
            <Route path="requests" element={<Requests />} />

            <Route path="students" element={<Students isCoopTeacher={isCoopTeacher} />} />
            <Route
              path="students/:studentId"
              element={<StudentDetail />}
            />

            <Route path="exams" element={<Exams />} />
            <Route path="profile" element={<Profile />} />
            <Route path="review-t002" element={<T_T002Review />} />
            <Route path="review-t003" element={<T_T003Review />} />
            <Route path="review-supervision" element={<T_SupervisionReview />} />
            <Route path="doc-t005-006" element={<A_DocT005_006 />} />
            <Route path="doc-t007" element={<A_DocT007 />} />
            <Route path="doc-t008" element={<A_DocT008 />} />

            <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
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
    >
      <path d="M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
      <path d="M16 12H8" />
      <path d="M19 12l-3-3" />
      <path d="M19 12l-3 3" />
    </svg>
  );
}
