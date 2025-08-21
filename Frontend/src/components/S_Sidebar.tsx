// src/components/Sidebar.tsx
import { NavLink } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand-text">Co-operative:</div>

      <nav className="nav" aria-label="Student Navigation">
        <NavLink
          to="/student/dashboard"
          end
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
        >
          <span className="icon" aria-hidden><IcDashboard /></span>
          <span className="text">Dashboard</span>
        </NavLink>

        <NavLink
          to="/student/profile"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
        >
          <span className="icon" aria-hidden><IcUser /></span>
          <span className="text">Profile</span>
        </NavLink>

        <NavLink
          to="/student/coop"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
        >
          <span className="icon" aria-hidden><IcBuilding /></span>
          <span className="text">Co-Company</span>
        </NavLink>

        <NavLink
          to="/student/daily"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
        >
          <span className="icon" aria-hidden><IcCalendar /></span>
          <span className="text">Daily</span>
        </NavLink>
      </nav>

      {/* ทำให้ไอคอน+คำอยู่ "บรรทัดเดียวกันเสมอ" + ellipsis */}
      <style>{`
        .sidebar .brand-text{
          font-weight: 900;
          margin: 24px 0;
          text-transform: uppercase;
          font-size: 20px;
        }
        .sidebar .nav { display: grid; gap: 6px; }
      }
        .sidebar .nav { display: grid; gap: 6px; }

        .sidebar .item{
          display:flex; align-items:center; gap:10px;
          padding:10px 12px; border-radius:12px;
          text-decoration:none; color:#334155;
          border:1px solid transparent;
          transition: background .12s ease, color .12s ease, border-color .12s ease;
          overflow:hidden; /* กันข้อความล้น */
        }
        .sidebar .item:hover{ background:#f4f6f8; color:#0f172a; border-color:rgba(0,0,0,.06); }
        .sidebar .item.active{ background:#fff; color:#0f172a; border-color:rgba(0,0,0,.08); }

        .sidebar .icon{ flex:0 0 22px; display:inline-flex; }
        .sidebar .icon svg{ width:22px; height:22px; display:block; color:#6b7280; }
        .sidebar .item.active .icon svg{ color:#0074B7; }

        .sidebar .text{
          flex:1 1 auto;
          min-width:0;                
          font-weight:700;
          white-space:nowrap;         
          overflow:hidden;             
          text-overflow:ellipsis;  
          margin-left:10px;   
        }
      `}</style>
    </aside>
  );
}

/* ---------- Minimal stroke-only icons ---------- */
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
