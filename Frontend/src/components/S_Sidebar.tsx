import { NavLink } from "react-router-dom";
import {
  IcDashboard,
  IcUser,
  IcDocs,
  IcCalendar,
} from "./icons";

import type { StudentProfile } from "./store";

export default function S_Sidebar({ profile }: { profile: StudentProfile }) {
  // ดึงข้อมูลคำร้องสหกิจ
  const coop = profile.coopRequest || profile.coop;

  // ✅ แก้ไขเงื่อนไข: เปิดเมนูเมื่อสถานะเป็น "QUALIFIED" (หรือขั้นตอนถัดๆ ไป)
  // เราต้องรวมสถานะหลังจาก QUALIFIED ด้วย ไม่อย่างนั้นพอไปขั้นตอนถัดไปเมนูจะหาย
  const showDocsMenu =
    coop?.status === 'QUALIFIED' ||
    coop?.status === 'WAITING_FOR_STAFF_CHECK' ||
    coop?.status === 'EDITS_REQUIRED' ||
    coop?.status === 'REQ_LETTER_ISSUED' ||
    coop?.status === 'DOCS_APPROVED' ||
    coop?.status === 'WAITING_FOR_PLACEMENT_LETTER' ||
    coop?.status === 'WAITING_FOR_STAFF_CHECK_LETTER' ||
    coop?.status === 'ACCEPTANCE_CHECKED' ||
    coop?.status === 'PLACEMENT_LETTER_ISSUED' ||

    coop?.status === 'INTERNSHIP_STARTED';

  return (
    <aside className="sidebar">

      {/* BRAND HEADER */}
      <div className="brand">
        <div className="brand-sub">Co-operative:</div>
        <div className="brand-main">
          <span className="brand-bullet" />
          <span>Student</span>
        </div>
        <div className="brand-underline" />
      </div>

      {/* NAVIGATION */}
      <nav className="nav" aria-label="Student Navigation">

        <NavLink
          to="/student/dashboard"
          end
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
        >
          <span className="ico"><IcDashboard /></span>
          <span className="text">Dashboard</span>
        </NavLink>

        <NavLink
          to="/student/profile"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
        >
          <span className="ico"><IcUser /></span>
          <span className="text">ข้อมูลนักศึกษา</span>
        </NavLink>

        <NavLink
          to="/student/company"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
        >
          <span className="ico"><IcUser /></span>
          <span className="text">ข้อมูลบริษัท</span>
        </NavLink>

        {/* ✅ ใช้ตัวแปร showDocsMenu แทน */}
        {showDocsMenu && (
          <>
            <div style={{ margin: "16px 0 8px 12px", fontSize: "11px", fontWeight: "800", color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              COOP PROCESS
            </div>

            <NavLink
              to="/student/docs"
              className={({ isActive }) => "item" + (isActive ? " active" : "")}
            >
              <span className="ico"><IcDocs /></span>
              <span className="text">เอกสารสหกิจ (CP-T000)</span>
            </NavLink>

            <NavLink
              to="/student/daily"
              className={({ isActive }) => "item" + (isActive ? " active" : "")}
            >
              <span className="ico"><IcCalendar /></span>
              <span className="text">บันทึกประจำวัน</span>
            </NavLink>
          </>
        )}

      </nav>

      <style>{SIDEBAR_CSS}</style>
    </aside>
  );
}

// ... (SIDEBAR_CSS คงเดิม)
const SIDEBAR_CSS = `
.brand { margin: 22px 0 26px; padding-left: 4px; }
.brand-sub { font-weight: 900; font-size: 24px; color: #0f172a; }
.brand-main { margin-top: 4px; display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 16px; color: #334155; }
.brand-main > span:last-child { background: linear-gradient(90deg,#0074B7,#60A5FA,#22D3EE); -webkit-background-clip: text; color: transparent; }
.brand-bullet { width: 10px; height: 10px; border-radius: 50%; background: linear-gradient(135deg,#93C5FD,#3B82F6); box-shadow: 0 0 0 4px rgba(59,130,246,.15); }
.brand-underline { margin-top: 10px; height: 3px; width: 72px; border-radius: 999px; background: linear-gradient(90deg,#E6F0FF,#BFD7ED); }
.nav { display: grid; gap: 6px; }
.item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; text-decoration: none; color: #334155; border: 1px solid transparent; line-height: 1; transition: background .12s ease, border-color .12s ease, color .12s ease; }
.item:hover { background: #f4f6f8; border-color: rgba(0,0,0,.06); }
.item.active { background: #fff; border-color: rgba(0,0,0,.1); box-shadow: 0 6px 18px rgba(10,132,255,.12); }
.ico svg { width: 20px; height: 20px; color: #6b7280; }
.item.active .ico svg { color: #0074B7; }
.text { flex: 1; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 900px) { .sidebar { padding-bottom: 10px; border-bottom: 1px solid rgba(0,0,0,.06); } .nav { display: flex; flex-direction: row; overflow-x: auto; gap: 8px; padding-bottom: 8px; } .item { min-width: max-content; } }
`;