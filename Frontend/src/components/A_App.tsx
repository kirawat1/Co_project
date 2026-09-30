import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { ThemeToggleBtn } from "./ThemeContext";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Sidebar from "./A_Sidebar";
import Dashboard from "./A_Dashboard";
import Students from "./A_Students";
import Mentors from "./A_Mentors";
import Contacts from "./A_Contacts";
import Docs from "./A_Docs";
import Daily from "./A_Daily";
import Announcements from "./A_Announcements";
import Settings from "./A_Settings";
import StudentTheme from "./S_Theme";         // ใช้ธีมเดียว
import coopLogo from "../assets/COOP_Logo.png";
import Teachers from "./A_Teacher";
import Companies from "./A_Company";
import StaffCriteriaPage from "./A_CriteriaPage";
import A_Logs from "./A_Logs";
import A_Feedback from "./A_Feedback";
import DocT000 from "./A_DocT000";
import DocT002 from "./A_DocT002Review";
import DocT003 from "./A_DocT003Review";
import Coopperiod from "./A_CoopPeriod";
import CoopApplications from "./A_CoopApplications";
import A_DocRequirements from "./A_DocRequirements";
import A_SupervisionManager from "./A_SupervisionManage";
import A_DocT005_006 from "./A_DocT005_006";
import A_DocT007 from "./A_DocT007";
import A_SupervisionEval from "./A_SupervisionEval";
import A_DocT008 from "./A_DocT008";
import A_GatewaySettings from "./A_GatewaySettings";
import A_StaffManage from "./A_StaffManage";
import { useMyScope } from "../hooks/useMyScope";
import { AdminRoleContext } from "./adminRole";
import { getMajorFilter, setMajorFilter, NO_MAJOR } from "../utils/majorFilter";


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


  // เจ้าหน้าที่ = ทุกหน้า · อาจารย์ประจำวิชา = หน้าจัดการหลักสูตรที่ดูแล (ยกเว้นหน้าเจ้าหน้าที่) · อื่นๆ กลับหน้าของตัวเอง
  const scope = useMyScope();
  const role = (profile?.role || "").toLowerCase();
  const isStaff = role === "staff";
  const coopMajors = role === "teacher" && scope && !scope.all ? scope.majors : [];
  const isCoopTeacher = coopMajors.length > 0;
  const roleReady = !!profile && (isStaff || role === "student" || scope !== null);
  const displayName = isCoopTeacher ? `อาจารย์ประจำวิชา · ${coopMajors.join(", ")}` : (profile?.email || "เจ้าหน้าที่");

  useEffect(() => {
    if (!roleReady || isStaff || isCoopTeacher) return;
    navigate(role === "teacher" ? "/teacher/dashboard" : role === "student" ? "/student/dashboard" : "/", { replace: true });
  }, [roleReady, isStaff, isCoopTeacher, role, navigate]);

  // ตัวกรองหลักสูตร (ดูอย่างเดียว) — เจ้าหน้าที่เลือกได้ทุกหลักสูตร · อาจารย์ประจำวิชาที่ดูแลหลายหลักสูตรเลือกในหลักสูตรตัวเอง
  const [allMajors, setAllMajors] = useState<string[]>([]);
  const [majorFilter, setMajorFilterState] = useState<string>(getMajorFilter());
  useEffect(() => {
    if (!isStaff) return;
    apiFetch("/api/admin/majors").then(r => (r.ok ? r.json() : null)).then(d => { if (d?.ok) setAllMajors(d.majors ?? []); }).catch(() => {});
  }, [isStaff]);
  const filterOptions = isStaff ? allMajors : coopMajors;
  const showFilter = isStaff || coopMajors.length > 1;
  const effectiveFilter = majorFilter === NO_MAJOR ? (isStaff ? NO_MAJOR : "") : (filterOptions.includes(majorFilter) ? majorFilter : "");
  const changeFilter = (v: string) => { setMajorFilter(v); setMajorFilterState(v); };
  // ค่าที่จำไว้ใช้ไม่ได้แล้ว (หลักสูตรถูกลบ / ไม่ได้ดูแลแล้ว) → ล้างทิ้ง ไม่งั้น header ยังกรองอยู่ทั้งที่หน้าจอบอก "ทุกหลักสูตร"
  const optionsReady = isStaff ? allMajors.length > 0 : isCoopTeacher;
  useEffect(() => {
    if (optionsReady && majorFilter !== effectiveFilter) changeFilter(effectiveFilter);
  }, [optionsReady, majorFilter, effectiveFilter]);

  // หน้าเจ้าหน้าที่เท่านั้น — อาจารย์ประจำวิชาพิมพ์ URL ตรงก็เด้งกลับ
  const staffOnly = (el: React.ReactElement) => (isStaff ? el : <Navigate to="/admin/dashboard" replace />);

  useEffect(() => {
    const token = localStorage.getItem("coop.token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    apiFetch("/api/auth/me")
      .then(res => res.json())
      .then(data => {
        if (!data.ok) throw new Error("unauthorized");
        setProfile(data.user);
      })
      .catch((err: unknown) => {
        // fetch โยน TypeError เมื่อ request ถูกยกเลิก (เจ้าหน้าที่กดเมนูอื่นทันทีหลังหน้าโหลด)
        // หรือเน็ตหลุดชั่วคราว — ไม่ใช่ปัญหาสิทธิ์ ถ้าลบ token ตรงนี้จะเด้งออกทั้งที่ยังล็อกอินอยู่
        // (เจอจริงตอนรัน E2E: กด goto หน้าถัดไปเร็วเกินไปแล้วโดนเตะกลับหน้าล็อกอิน)
        if (err instanceof TypeError) return;
        localStorage.removeItem("coop.token");
        navigate("/", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  function onLogout() {
    localStorage.removeItem("coop.token");
    navigate("/", { replace: true });
  }

  if (loading || !roleReady || (!isStaff && !isCoopTeacher)) {
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
          {showFilter && (
            <select
              className="input"
              aria-label="กรองตามหลักสูตร"
              title="กรองข้อมูลทุกหน้าตามหลักสูตร"
              value={effectiveFilter}
              onChange={e => changeFilter(e.target.value)}
              style={{ width: "auto", height: 34, padding: "0 10px", fontSize: 13, fontWeight: 600, borderColor: effectiveFilter ? "#2563eb" : undefined, color: effectiveFilter ? "#1d4ed8" : undefined }}
            >
              <option value="">{isStaff ? "📚 ทุกหลักสูตร" : "📚 ทุกหลักสูตรที่ดูแล"}</option>
              {filterOptions.map(m => <option key={m} value={m}>หลักสูตร {m}</option>)}
              {isStaff && <option value={NO_MAJOR}>⚠️ ยังไม่ระบุหลักสูตร</option>}
            </select>
          )}
          <div className="user-mini">
            <div className="user-ava" />
            <div className="user-name">{displayName}</div>
          </div>
          {isCoopTeacher && (
            <button className="btn-secondary small" onClick={() => navigate("/teacher/dashboard")} title="กลับไปหน้าอาจารย์ (นักศึกษาในที่ปรึกษา นัดนิเทศของฉัน)">
              👤 หน้าอาจารย์ของฉัน
            </button>
          )}
          <ThemeToggleBtn />
          <button className="btn-ico" onClick={onLogout} aria-label="ออกจากระบบ" title="ออกจากระบบ">
            <LogoutIcon />
          </button>
        </div>
      </header>

      <div className="layout">
        <div className={`sidebar-overlay${sidebarOpen ? " open" : ""}`} onClick={() => setSidebarOpen(false)} />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isStaff={isStaff} roleLabel={isStaff ? "Staff" : `จัดการหลักสูตร ${coopMajors.join(", ")}`} />
        <main className="main">
          <AdminRoleContext.Provider value={{ isStaff, majors: coopMajors }}>
          {/* เปลี่ยนตัวกรองหลักสูตร → remount หน้าเพื่อโหลดข้อมูลใหม่ */}
          <Routes key={effectiveFilter}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="mentors" element={<Mentors />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="company" element={<Companies />} />
            <Route path="docs" element={<Docs />} />
            <Route path="daily" element={<Daily />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="settings" element={staffOnly(<Settings />)} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="criteria" element={staffOnly(<StaffCriteriaPage />)} />
            <Route path="doct000" element={<DocT000 />} />
            <Route path="doct002" element={<DocT002 />} />
            <Route path="doct003" element={<DocT003 />} />
            <Route path="coop-period" element={<Coopperiod />} />
            <Route path="staff" element={staffOnly(<A_StaffManage />)} />
            <Route path="coop-applications" element={<CoopApplications />} />
            <Route path="supervision-manager" element={<A_SupervisionManager />} />
            <Route path="logs" element={staffOnly(<A_Logs />)} />
            <Route path="feedback" element={staffOnly(<A_Feedback />)} />
            <Route path="doc-t005-006" element={<A_DocT005_006 />} />
            <Route path="doc-t007" element={<A_DocT007 />} />
            <Route path="supervision-eval" element={<A_SupervisionEval />} />
            <Route path="doc-t008" element={<A_DocT008 />} />
            {/* ✅ ย้ายขึ้นมา และลบ /admin/ ออก */}
            <Route path="doc-requirements" element={<A_DocRequirements />} />
            <Route path="gateway-settings" element={<A_GatewaySettings />} />

            {/* ✅ ใส่ /admin/ นำหน้า เพื่อป้องกัน Infinite Loop */}
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
          </AdminRoleContext.Provider>
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