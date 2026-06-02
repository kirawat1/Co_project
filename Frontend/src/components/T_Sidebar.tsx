import { NavLink } from "react-router-dom";
import {
  IcDashboard,
  IcUsers,
  IcDocs,
  IcCalendar,
  IcUser,
} from "./icons";
import NotificationBell from "./NotificationBell";

interface SidebarProps { isOpen?: boolean; onClose?: () => void; }

export default function T_Sidebar({ isOpen = false, onClose = () => {} }: SidebarProps) {
  const nav = () => onClose();
  return (
    <aside className={`sidebar${isOpen ? " open" : ""}`}>
      {/* BRAND HEADER (เหมือน S_Sidebar) */}
      <div className="brand">
        <div className="brand-sub">Co-operative:</div>

        <div className="brand-main">
          <span className="brand-bullet" />
          <span>Teacher</span>
        </div>

        <div className="brand-underline" />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 4px", marginBottom: 8 }}>
        <NotificationBell targetPath="/teacher/students" />
      </div>

      {/* NAVIGATION */}
      <nav className="nav" aria-label="Teacher Navigation">
        <NavLink
          to="/teacher/dashboard"
          end
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDashboard /></span>
          <span className="text">Dashboard</span>
        </NavLink>

        <div className="sec-label">ข้อมูลบุคคล</div>

        <NavLink
          to="/teacher/students"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcUsers /></span>
          <span className="text">นักศึกษาที่ดูแล</span>
        </NavLink>

        <NavLink
          to="/teacher/profile"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcUser /></span>
          <span className="text">ข้อมูลอาจารย์</span>
        </NavLink>

        <div className="sec-label">เอกสารและบันทึก</div>

        <NavLink
          to="/teacher/requests"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">ตรวจสอบคำร้องสหกิจ</span>
        </NavLink>

        <NavLink
          to="/teacher/review-t002"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">T002 เอกสารรายละเอียด</span>
        </NavLink>

        <NavLink
          to="/teacher/review-t003"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">T003 โครงร่างรายงาน</span>
        </NavLink>

        <NavLink
          to="/teacher/review-supervision"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcCalendar /></span>
          <span className="text">นัดหมายนิเทศ</span>
        </NavLink>

        <NavLink
          to="/teacher/doc-t005-006"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">T005/T006 ประเมิน</span>
        </NavLink>

        <NavLink
          to="/teacher/doc-t007"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">T007 ประเมิน</span>
        </NavLink>

        <NavLink
          to="/teacher/doc-t008"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
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
  margin: 18px 0 4px 6px;
  font-size: 12px;
  color: #6b7280;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
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
