import { NavLink } from "react-router-dom";
import {
  IcDashboard,
  IcUsers,
  IcCalendar,
  IcUser,
  IcInbox,
  IcList,
  IcRoute,
  IcStar,
  IcClipboardCheck,
  IcBook,
} from "./icons";
import { useNotifCounts } from "../hooks/useNotifCounts";

interface SidebarProps { isOpen?: boolean; onClose?: () => void; }

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

export default function T_Sidebar({ isOpen = false, onClose = () => {} }: SidebarProps) {
  const nav = () => onClose();
  const { counts, markAllRead } = useNotifCounts();
  const navAndRead = () => { onClose(); markAllRead(); };
  return (
    <aside className={`sidebar${isOpen ? " open" : ""}`}>
      {/* BRAND HEADER */}
      <div className="brand">
        <div className="brand-sub">Co-operative:</div>
        <div className="brand-main">
          <span className="brand-bullet" />
          <span>Teacher</span>
        </div>
        <div className="brand-underline" />
      </div>

      {/* NAVIGATION */}
      <nav className="nav" aria-label="Teacher Navigation">
        <NavItem to="/teacher/dashboard" label="Dashboard" icon={<IcDashboard />} end onClick={nav} />

        <div className="sec-label">ข้อมูลบุคคล</div>

        <NavItem to="/teacher/students" label="นักศึกษาที่ดูแล" icon={<IcUsers />}
          count={(counts.T002_SUBMITTED ?? 0) + (counts.T003_SUBMITTED ?? 0) + (counts.SUPERVISION_PROPOSED ?? 0) + (counts.COOP_APPLICATION_SUBMITTED ?? 0)}
          onClick={navAndRead} />
        <NavItem to="/teacher/profile" label="ข้อมูลอาจารย์" icon={<IcUser />} onClick={nav} />

        <div className="sec-label">เอกสารและบันทึก</div>

        <NavItem to="/teacher/requests" label="ตรวจสอบคำร้องสหกิจ" icon={<IcInbox />}
          count={(counts.COOP_APPLICATION_SUBMITTED ?? 0) + (counts.ACCEPTANCE_UPLOADED ?? 0)}
          onClick={navAndRead} />
        <NavItem to="/teacher/review-t002" label="T002 เอกสารรายละเอียด" icon={<IcList />}
          count={counts.T002_SUBMITTED ?? 0} onClick={navAndRead} />
        <NavItem to="/teacher/review-t003" label="T003 โครงร่างรายงาน" icon={<IcRoute />}
          count={counts.T003_SUBMITTED ?? 0} onClick={navAndRead} />
        <NavItem to="/teacher/review-supervision" label="นัดหมายนิเทศ" icon={<IcCalendar />}
          count={counts.SUPERVISION_PROPOSED ?? 0} onClick={navAndRead} />

        <NavLink
          to="/teacher/doc-t005-006"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcStar /></span>
          <span className="text">T005/T006 ประเมิน</span>
        </NavLink>

        <NavLink
          to="/teacher/doc-t007"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcClipboardCheck /></span>
          <span className="text">T007 ประเมิน</span>
        </NavLink>

        <NavLink
          to="/teacher/doc-t008"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcBook /></span>
          <span className="text">T008 เล่มรายงานสหกิจ </span>
        </NavLink>


      </nav>

      <style>{SIDEBAR_CSS}</style>
    </aside>
  );
}

/* ===== CSS ชุดเดียวกับ S_Sidebar ===== */
const SIDEBAR_CSS = `
.brand { margin: 22px 0 26px; padding-left: 4px; }
.brand-sub {
  font-weight: 900;
  font-size: 24px;
  color: #0f172a;
}
.brand-main {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 16px;
  color: #334155;
}
.brand-main > span:last-child {
  background: linear-gradient(90deg,#0074B7,#60A5FA,#22D3EE);
  -webkit-background-clip: text;
  color: transparent;
}
.brand-bullet {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg,#93C5FD,#3B82F6);
  box-shadow: 0 0 0 4px rgba(59,130,246,.15);
}
.brand-underline {
  margin-top: 10px; height: 3px; width: 72px;
  border-radius: 999px;
  background: linear-gradient(90deg,#E6F0FF,#BFD7ED);
}

.nav { display: grid; gap: 6px; }

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  text-decoration: none;
  color: #334155;
  border: 1px solid transparent;
  line-height: 1;
  transition: background .12s ease, border-color .12s ease, color .12s ease;
}
.item:hover {
  background: #f4f6f8;
  border-color: rgba(0,0,0,.06);
}
.item.active {
  background: #fff;
  border-color: rgba(0,0,0,.1);
  box-shadow: 0 6px 18px rgba(10,132,255,.12);
}

.ico svg {
  width: 20px;
  height: 20px;
  color: #6b7280;
}
.item.active .ico svg {
  color: #0074B7;
}

.text {
  flex: 1;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sec-label {
  margin: 22px 0 6px 6px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
  font-size: 12px;
  color: #6b7280;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.sec-label:first-of-type {
  border-top: none;
  padding-top: 0;
}

@media (max-width: 900px) {
  .sidebar {
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(0,0,0,.06);
  }
  .nav {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    gap: 8px;
    padding-bottom: 8px;
  }
  .item { min-width: max-content; }
  .sec-label { display: none; }
}
`;
