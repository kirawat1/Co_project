import { NavLink } from "react-router-dom";
import {
  IcDashboard,
  IcUsers,
  IcUser,
  IcBuilding,
  IcDocs,
  IcCalendar,
  IcTeacher,
  IcAnnounce,
  IcSettings,
} from "./icons";
import NotificationBell from "./NotificationBell";

interface SidebarProps { isOpen?: boolean; onClose?: () => void; }

export default function A_Sidebar({ isOpen = false, onClose = () => {} }: SidebarProps) {
  const nav = () => onClose();
  return (
    <aside className={`sidebar${isOpen ? " open" : ""}`}>
      {/* BRAND BLOCK */}
      <div className="brand">
        <div className="brand-sub">Co-operative:</div>

        <div className="brand-main">
          <span className="brand-bullet" />
          <span>Staff</span>
        </div>

        <div className="brand-underline" />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 4px", marginBottom: 8 }}>
        <NotificationBell targetPath="/admin/students" />
      </div>

      {/* NAVIGATION */}
      <nav className="nav" aria-label="Admin Navigation">

        <NavLink
          to="/admin/dashboard"
          end
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDashboard /></span>
          <span className="text">Dashboard</span>
        </NavLink>

        <NavLink
          to="/admin/announcements"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcAnnounce /></span>
          <span className="text">ประกาศ</span>
        </NavLink>

        <div className="sec-label">ข้อมูลบุคคล</div>

        <NavLink
          to="/admin/students"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcUsers /></span>
          <span className="text">นักศึกษา</span>
        </NavLink>

        <NavLink
          to="/admin/teachers"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcTeacher /></span>
          <span className="text">อาจารย์</span>
        </NavLink>

        <NavLink
          to="/admin/mentors"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcUser /></span>
          <span className="text">พี่เลี้ยง</span>
        </NavLink>

        <div className="sec-label">ข้อมูลสถานประกอบการ</div>

        <NavLink
          to="/admin/company"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcBuilding /></span>
          <span className="text">บริษัท</span>
        </NavLink>

        <div className="sec-label">เอกสารและบันทึก</div>

        <NavLink
          to="/admin/coop-applications"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">ตรวจสอบคำร้องสหกิจ</span>
        </NavLink>

        <NavLink
          to="/admin/doct000"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">T000 เอกสารใบสมัคร</span>
        </NavLink>

        <NavLink
          to="/admin/doct002"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">T002 เอกสารรายละเอียด</span>
        </NavLink>

        <NavLink
          to="/admin/doct003"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">T003 โครงร่างรายงาน</span>
        </NavLink>

        <NavLink
          to="/admin/supervision-manager"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">จัดการการนิเทศ</span>
        </NavLink>

        <NavLink
          to="/admin/doc-t005-006"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">T005/T006 ประเมิน</span>
        </NavLink>

        <NavLink
          to="/admin/doc-t007"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">T007 ประเมิน</span>
        </NavLink>


        <NavLink
          to="/admin/doc-t008"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcDocs /></span>
          <span className="text">T008 เล่มรายงานสหกิจ </span>
        </NavLink>


        <div className="sec-label">การตั้งค่ารับเอกสาร</div>

        <NavLink to="/admin/doc-requirements" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico"><IcDocs /></span>
          <span className="text"> เอกสารใบสมัครงาน (T000)</span>
        </NavLink>

        <div className="sec-label">ระบบ</div>

        <NavLink
          to="/admin/coop-period"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcCalendar /></span>
          <span className="text">รอบรับสมัครสหกิจ</span>
        </NavLink>




        <NavLink
          to="/admin/criteria"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcSettings /></span>
          <span className="text">เงื่อนไขออกสหกิจศึกษา</span>
        </NavLink>

        <NavLink
          to="/admin/settings"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          onClick={nav}
        >
          <span className="ico"><IcSettings /></span>
          <span className="text">ตั้งค่า</span>
        </NavLink>



      </nav>

      {/* CSS */}
      <style>{SIDEBAR_CSS}</style>
    </aside>
  );
}


const SIDEBAR_CSS = `
/* ===== SIDEBAR CONTAINER (เพิ่มการเลื่อนขึ้นลง) ===== */
.sidebar {
  /* ทำให้เลื่อนแนวตั้งได้เมื่อเมนูยาวเกินจอ */
  overflow-y: auto; 
  /* (แนะนำ) กำหนดความสูงให้เต็มจอเพื่อให้เลื่อนได้พอดี หาก CSS หลักยังไม่ได้กำหนดไว้ */
  height: 100vh; 
  
  /* ปรับแต่ง Scrollbar สำหรับ Firefox */
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

/* ปรับแต่ง Scrollbar สำหรับ Chrome, Safari, Edge ให้ดูสวยงาม */
.sidebar::-webkit-scrollbar {
  width: 6px;
}
.sidebar::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 10px;
}
.sidebar::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

/* ===== BRAND HEADER ===== */
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


/* ===== SECTION LABELS ===== */
.sec-label {
  margin: 18px 0 4px 6px;
  font-size: 12px;
  color: #6b7280;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
}


/* ===== NAVIGATION ===== */
.nav { display: grid; gap: 6px; padding-bottom: 20px; /* เว้นระยะด้านล่างสุดตอนเลื่อนสุด */ }

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


/* ===== ICON & TEXT ALIGNMENT ===== */
.ico {
  display: inline-flex;
  align-items: center;
}
.ico svg {
  width: 20px;
  height: 20px;
  display: block;
  color: #6b7280;
}
.item.active .ico svg {
  color: #0074B7;
}

.text {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


/* ===== RESPONSIVE (iPad & Mobile) ===== */
@media (max-width: 900px) {
  .sidebar {
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(0,0,0,.06);
    height: auto; /* บนมือถือให้ความสูงเป็นออโต้ */
    overflow-y: visible; /* ปิดการเลื่อนแนวตั้งบนมือถือ */
  }
  .nav {
    display: flex;
    flex-direction: row;
    overflow-x: auto; /* มือถือเลื่อนซ้ายขวาแทน */
    gap: 8px;
    padding-bottom: 8px;
  }
  .item {
    min-width: max-content;
  }
  .sec-label { display: none; }
}
`;