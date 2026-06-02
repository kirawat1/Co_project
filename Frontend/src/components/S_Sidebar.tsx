import { NavLink } from "react-router-dom";
import { IcDashboard, IcUser, IcDocs } from "./icons";
import { useNotifCounts } from "../hooks/useNotifCounts";

function NavItem({ to, label, icon, count, onClick, end }: {
  to: string; label: string; icon: React.ReactNode;
  count?: number; onClick?: () => void; end?: boolean;
}) {
  const hasCount = (count ?? 0) > 0;
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => "item" + (isActive ? " active" : "")}
      onClick={onClick}
      style={hasCount ? { border: "1.5px solid #ef4444", borderRadius: 10 } : undefined}
    >
      <span className="ico">{icon}</span>
      <span className="text" style={{ flex: 1 }}>{label}</span>
      {hasCount && (
        <span style={{ background: "#ef4444", color: "#fff", borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
          {count}
        </span>
      )}
    </NavLink>
  );
}

import type { StudentProfile } from "./store";

interface SidebarProps {
  profile: StudentProfile;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function S_Sidebar({ profile, isOpen = false, onClose = () => {} }: SidebarProps) {
  // ปิด sidebar เมื่อกด NavLink (สำคัญบนมือถือ)
  const handleNav = () => onClose();
  // ดึงข้อมูลคำร้องสหกิจ
  const coop = profile.coopRequest || profile.coop;
  const { counts, markAllRead } = useNotifCounts();
  const navAndRead = () => { handleNav(); markAllRead(); };

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
    coop?.status === 'INTERNSHIP_STARTED' ||
    coop?.status === 'T002_SUBMITTED' ||
    coop?.status === 'T002_EDITS_REQUIRED' ||
    coop?.status === 'T003_SUBMITTED' ||
    coop?.status === 'T003_EDITS_REQUIRED' ||
    coop?.status === 'T003_APPROVED' ||
    coop?.status === 'PENDING_TEACHER' ||
    coop?.status === 'TEACHER_REJECTED' ||
    coop?.status === 'DATE_CONFIRMED' ||
    coop?.status === 'LETTER_UPLOADED' ||
    coop?.status === 'COMPLETED';

  return (
    <aside className={`sidebar${isOpen ? " open" : ""}`}>

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

        <NavItem to="/student/dashboard" label="Dashboard" icon={<IcDashboard />} end onClick={handleNav} />

        <NavItem to="/student/status-tracker" label="สถานะสหกิจ" onClick={navAndRead}
          count={(counts.STATUS_UPDATED ?? 0) + (counts.REQ_LETTER_ISSUED ?? 0) + (counts.PLACEMENT_LETTER_ISSUED ?? 0)}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />

        <NavItem to="/student/profile" label="ข้อมูลนักศึกษา" icon={<IcUser />} onClick={handleNav} />
        <NavItem to="/student/company" label="ข้อมูลบริษัท" icon={<IcUser />} onClick={handleNav} />

        <NavLink to="/student/announcements" className={({ isActive }) => "item" + (isActive ? " active" : "")} onClick={handleNav}>
          <span className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg></span>
          <span className="text">ประกาศ</span>
        </NavLink>

        <NavItem to="/student/gateway" label="ยื่นคำร้องสหกิจ" icon={<IcDocs />} onClick={handleNav} />

        {showDocsMenu && (
          <>
            <div style={{ margin: "16px 0 8px 12px", fontSize: "11px", fontWeight: "800", color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              COOP PROCESS
            </div>

            <NavItem to="/student/docs" label="เอกสารสหกิจ (CP-T000)" icon={<IcDocs />} onClick={handleNav} />

            <NavItem to="/student/docs-t002" label="เอกสารรายละเอียด (CP-T002)" icon={<IcDocs />}
              count={counts.T002_REVIEWED ?? 0} onClick={navAndRead} />

            <NavItem to="/student/docs-t003" label="เอกสารรายละเอียด (CP-T003)" icon={<IcDocs />}
              count={counts.T003_REVIEWED ?? 0} onClick={navAndRead} />

            <NavItem to="/student/supervision" label="นัดหมายนิเทศ" icon={<IcDocs />}
              count={(counts.SUPERVISION_DATE_UPDATED ?? 0) + (counts.SUPERVISION_LETTER_UPLOADED ?? 0)}
              onClick={navAndRead} />

            <NavLink
              to="/student/doc-t005-006"
              className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={handleNav}
            >
              <span className="ico"><IcDocs /></span>
              <span className="text">T005/T006 เอกสารประเมิน</span>
            </NavLink>

            <NavLink
              to="/student/doc-t007"
              className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={handleNav}
            >
              <span className="ico"><IcDocs /></span>
              <span className="text">T007 เอกสารประเมิน</span>
            </NavLink>

            <NavLink
              to="/student/doc-t008"
              className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={handleNav}
            >
              <span className="ico"><IcDocs /></span>
              <span className="text">เล่มรายงานสหกิจ 008</span>
            </NavLink>




            {/* <NavLink
              to="/student/daily"
              className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={handleNav}
            >
              <span className="ico"><IcCalendar /></span>
              <span className="text">บันทึกประจำวัน</span>
            </NavLink> */}
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