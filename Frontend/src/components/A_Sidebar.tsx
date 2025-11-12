import { NavLink } from "react-router-dom";

export default function A_Sidebar() {
  return (
    <aside className="sidebar">
      {/* ▼ Brand: Co-operative: (ใหญ่) / Admin (เล็กกว่า) */}
      <div className="brand">
        <div className="brand-sub">Co-operative:</div>
        <div className="brand-main">
          <span className="brand-bullet" aria-hidden="true" />
          <span>Admin</span>
        </div>
        <div className="brand-underline" aria-hidden="true" />
      </div>

      <nav className="nav" aria-label="Admin Navigation">
        <NavLink to="/admin/dashboard" end className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico"><DashboardIcon /></span>
          <span className="text">Dashboard</span>
        </NavLink>

        <NavLink to="/admin/students" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico"><UsersIcon /></span>
          <span className="text">นักศึกษา</span>
        </NavLink>

        <NavLink to="/admin/mentors" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico"><UserIcon /></span>
          <span className="text">พี่เลี้ยง</span>
        </NavLink>

        <NavLink to="/admin/teachers" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico"><TeacherIcon /></span>
          <span className="text">อาจารย์</span>
        </NavLink>

        <NavLink to="/admin/docs" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico"><DocsIcon /></span>
          <span className="text">เอกสาร</span>
        </NavLink>

        <NavLink to="/admin/daily" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico"><CalendarCheckIcon /></span>
          <span className="text">บันทึกประจำวัน</span>
        </NavLink>

        <NavLink to="/admin/announcements" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico"><MegaphoneIcon /></span>
          <span className="text">ประกาศ</span>
        </NavLink>

        <NavLink to="/admin/settings" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico"><SettingsIcon /></span>
          <span className="text">ตั้งค่า</span>
        </NavLink>
      </nav>

      <style>{`
        /* ===== Brand header (เหมือน M_Sidebar) ===== */
        .brand{ margin:20px 0 24px; }
        .brand-sub{
          font-weight:900; font-size:26px; line-height:1.1;
          letter-spacing:.01em; color:#0f172a;
        }
        .brand-main{
          margin-top:6px; display:flex; align-items:center; gap:10px;
          font-weight:800; font-size:16px; line-height:1; color:#334155;
        }
        .brand-main > span:last-child{
          background: linear-gradient(90deg, #0074B7 0%, #60A5FA 50%, #22D3EE 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .brand-bullet{
          width:8px; height:8px; border-radius:50%;
          background: linear-gradient(135deg,#93C5FD,#3B82F6);
          box-shadow:0 0 0 4px rgba(59,130,246,.12);
        }
        .brand-underline{
          margin-top:10px; height:3px; width:64px; border-radius:999px;
          background: linear-gradient(90deg,#E6F0FF,#BFD7ED);
        }

        /* ===== Nav items (พฤติกรรมเหมือน M_Sidebar) ===== */
        .sidebar .nav{ display:grid; gap:6px }
        .sidebar .item{
          display:flex; align-items:center; gap:10px;
          padding:10px 12px; border-radius:12px; text-decoration:none;
          color:#334155; border:1px solid transparent;
          transition: background .12s ease, color .12s ease, border-color .12s ease;
        }
        .sidebar .item:hover{ background:#f4f6f8; color:#0f172a; border-color:rgba(0,0,0,.06); }
        .sidebar .item.active{ background:#fff; color:#0f172a; border-color:rgba(0,0,0,.08); }

        /* Icon & text */
        .sidebar .ico{ display:inline-flex; align-items:center; justify-content:center; }
        .sidebar .ico svg{ width:18px; height:18px; display:block; stroke:currentColor; }
        .sidebar .text{
          flex:1 1 auto; min-width:0; font-weight:700;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-left:10px;
        }
      `}</style>
    </aside>
  );
}

/* ===== Inline SVG icons (ชุดเดียวกับ M_Sidebar + เพิ่ม Docs/Megaphone/Settings) ===== */
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13h8V3H3v10zM13 21h8V11h-8v10zM13 3v6h8V3h-8zM3 21h8v-6H3v6z" />
    </svg>
  );
}

function TeacherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4" />
      <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
      <path d="M8 11h8" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 11a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 11Z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function DocsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12" />
      <path d="M14 2v6a2 2 0 0 0 2 2h6" />
    </svg>
  );
}
function CalendarCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}
function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11v2a4 4 0 0 0 4 4h1" />
      <path d="M11 5l10 4v6l-10 4V5Z" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06Z" />
    </svg>
  );
}
