import { NavLink } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Brand: Co-operative: (บน) / Student (ล่าง) */}
      <div className="brand">
        <div className="brand-sub">Co-operative:</div>
        <div className="brand-main">
          <span className="brand-bullet" aria-hidden />
          <span>Student</span>
        </div>
        <div className="brand-underline" aria-hidden />
      </div>

      <nav className="nav" aria-label="Student Navigation">
        <NavLink to="/student/dashboard" end className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico" aria-hidden><IcDashboard /></span>
          <span className="text">Dashboard</span>
        </NavLink>

        <NavLink to="/student/profile" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico" aria-hidden><IcUser /></span>
          <span className="text">Profile</span>
        </NavLink>

        <NavLink to="/student/coop" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico" aria-hidden><IcBuilding /></span>
          <span className="text">Co-Company</span>
        </NavLink>

        {/* ซ้อนการใช้งาน Daily ไว้ */}
        <NavLink to="/student/daily" className={({ isActive }) => "item" + (isActive ? " active" : "")}>
          <span className="ico" aria-hidden><IcCalendar /></span>
          <span className="text">Daily</span>
        </NavLink>
      </nav>

      <style>{`
        /* ===== THEME (เหมือน A_Sidebar) ===== */
        .sidebar{
          --brand: #0074B7;
          --nav-fg: #334155;
          --nav-fg-active: #0f172a;
          --nav-bg-hover: #f4f6f8;
          --nav-bg-active: #ffffff;
          --nav-border: rgba(0,0,0,.08);
          --ico-size: 18px;         /* ← ขนาดไอคอน統一 */
          --ico-stroke: 1.6;        /* ← น้ำหนักเส้น */
        }

        /* ===== Brand header ===== */
        .brand{ margin:20px 0 24px; }
        .brand-sub{ font-weight:900; font-size:26px; line-height:1.1; letter-spacing:.01em; color:#0f172a; }
        .brand-main{ margin-top:6px; display:flex; align-items:center; gap:10px; font-weight:800; font-size:16px; line-height:1; color:#334155; }
        .brand-bullet{ width:10px; height:10px; border-radius:50%; background: linear-gradient(135deg,#93C5FD,#3B82F6); box-shadow:0 0 0 4px rgba(59,130,246,.12); }
        .brand-main > span:last-child{
          background: linear-gradient(90deg,var(--brand) 0%, #60A5FA 50%, #22D3EE 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }
        .brand-underline{ margin-top:10px; height:3px; width:64px; border-radius:999px; background: linear-gradient(90deg,#E6F0FF,#BFD7ED); }

        /* ===== Nav items (match A_Sidebar) ===== */
        .nav { display:grid; gap:6px; }
        .item{
          display:flex; align-items:center; gap:10px;
          padding:10px 12px; border-radius:12px; text-decoration:none;
          color:var(--nav-fg); border:1px solid transparent;
          transition: background .12s ease, color .12s ease, border-color .12s ease, box-shadow .12s ease;
          overflow:hidden;
        }
        .item:hover{ background:var(--nav-bg-hover); color:var(--nav-fg-active); border-color:rgba(0,0,0,.06); }
        .item.active{ background:var(--nav-bg-active); color:var(--nav-fg-active); border-color:var(--nav-border); box-shadow:0 1px 0 rgba(0,0,0,.02); }

        /* Icons & text (統一ขนาด/น้ำหนักเส้นตามธีม) */
        .ico{ display:inline-flex; align-items:center; justify-content:center; }
        .ico svg{ width:var(--ico-size); height:var(--ico-size); display:block; }
        .text{
          flex:1 1 auto; min-width:0; font-weight:700;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-left:10px;
        }
      `}</style>
    </aside>
  );
}

/* ---------- Stroke-only icons (theme: currentColor / 1.6 / 18px) ---------- */
function BaseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}
function IcDashboard() {
  return (
    <BaseIcon>
      <rect x="4" y="4" width="6" height="6" rx="1.2" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" />
    </BaseIcon>
  );
}
function IcUser() {
  return (
    <BaseIcon>
      <path d="M12 11a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 11Z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </BaseIcon>
  );
}
function IcBuilding() {
  return (
    <BaseIcon>
      <rect x="4" y="7" width="16" height="13" rx="2" />
      <path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
    </BaseIcon>
  );
}
function IcCalendar() {
  return (
    <BaseIcon>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </BaseIcon>
  );
}
