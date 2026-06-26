// src/components/S_Theme.tsx — Global CSS variables (light + dark) + responsive layout
export default function StudentTheme({ IOS_BLUE = "#0074B7" }: { IOS_BLUE?: string }) {
  return <style>{css(IOS_BLUE)}</style>;
}

function css(IOS_BLUE: string) {
  return `
  /* ===== CSS VARIABLES: Light mode ===== */
  :root {
    --ios-blue: ${IOS_BLUE};
    --shadow: 0 10px 40px rgba(10,132,255,.15);
    --font-ui: "Inter Variable","Noto Sans Thai Variable","Inter","Noto Sans Thai",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;

    --bg:          #f7faff;
    --bg-gradient: radial-gradient(1200px 700px at 80% -10%, #E6F0FF 0%, #F7FAFF 40%, #FFFFFF 100%);
    --surface:     #ffffff;
    --surface2:    #f8fafc;
    --border:      rgba(0,0,0,.07);
    --text:        #0f172a;
    --text-muted:  #64748b;
    --text-sub:    #94a3b8;
    --sidebar-bg:  rgba(255,255,255,.85);
    --topbar-bg:   #ffffff;
    --input-bg:    #ffffff;
    --input-border:#e5e7eb;
    --hover-bg:    #f3f4f6;
    --active-bg:   #ffffff;
    --active-shadow: 0 6px 18px rgba(10,132,255,.18);
    --card-bg:     #ffffff;
    --card-border: rgba(0,0,0,.06);
  }

  /* ===== CSS VARIABLES: Dark mode ===== */
  [data-theme="dark"] {
    --bg:          #0f172a;
    --bg-gradient: #0f172a;
    --surface:     #1e293b;
    --surface2:    #0f172a;
    --border:      rgba(255,255,255,.09);
    --text:        #f1f5f9;
    --text-muted:  #94a3b8;
    --text-sub:    #64748b;
    --sidebar-bg:  rgba(30,41,59,.95);
    --topbar-bg:   #1e293b;
    --input-bg:    #1e293b;
    --input-border:#334155;
    --hover-bg:    #334155;
    --active-bg:   #263248;
    --active-shadow: 0 6px 18px rgba(10,132,255,.22);
    --card-bg:     #1e293b;
    --card-border: rgba(255,255,255,.08);
  }

  /* ===== BASE ===== */
  *, *::before, *::after { box-sizing: border-box; }
  body, .app-bg, .sidebar, .main, .card, .btn, .input, .label {
    font-family: var(--font-ui);
    line-height: 1.55;
    letter-spacing: .1px;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }
  input, button, select, textarea { font: inherit; }

  /* ===== APP BACKGROUND ===== */
  .app-bg {
    min-height: 100dvh;
    background: var(--bg-gradient);
    color: var(--text);
    transition: background .25s, color .25s;
  }

  /* ===== TOPBAR ===== */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--topbar-bg);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 40;
    gap: 12px;
    transition: background .25s, border-color .25s;
  }
  .topbar-right { display: flex; align-items: center; gap: 10px; }
  .user-mini { display: flex; align-items: center; gap: 10px; color: var(--text); }
  .user-ava { width: 28px; height: 28px; border-radius: 8px; background: #3b82f6; }
  .user-name { font-weight: 700; font-size: 14px; color: var(--text); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .brand-badge { background: #E6F0FF; padding: 4px 8px; border-radius: 10px; display: inline-flex; align-items: center; border: 1px solid rgba(0,0,0,.05); }
  [data-theme="dark"] .brand-badge { background: #1e3a5f; border-color: rgba(255,255,255,.1); }
  .brand-img { height: 36px; width: auto; display: block; object-fit: contain; }

  /* ===== ICON BUTTONS (logout, dark toggle, hamburger) ===== */
  .btn-ico {
    width: 38px; height: 38px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 10px; border: 1px solid var(--border);
    background: var(--surface); color: var(--text); cursor: pointer;
    transition: .15s;
  }
  .btn-ico:hover { background: var(--hover-bg); border-color: #c7d2fe; color: ${IOS_BLUE}; }
  .btn-ico svg { width: 20px; height: 20px; }

  /* ===== LAYOUT ===== */
  .layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: calc(100dvh - 57px);
  }
  .main { min-width: 0; padding: 16px; }

  /* ===== SIDEBAR ===== */
  .sidebar {
    width: 240px;
    background: var(--sidebar-bg);
    backdrop-filter: blur(8px);
    border-right: 1px solid var(--border);
    padding: 20px 14px;
    position: sticky;
    top: 57px;
    height: calc(100dvh - 57px);
    overflow-y: auto;
    transition: background .25s, border-color .25s;
    z-index: 30;
  }

  /* Sidebar brand text */
  .brand-sub { font-weight: 900; font-size: 22px; color: var(--text); }
  .brand-main { margin-top: 4px; display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; color: var(--text-muted); }
  .brand-main > span:last-child { background: linear-gradient(90deg,#0074B7,#60A5FA,#22D3EE); -webkit-background-clip: text; color: transparent; background-clip: text; }
  .brand-bullet { width: 10px; height: 10px; border-radius: 50%; background: linear-gradient(135deg,#93C5FD,#3B82F6); box-shadow: 0 0 0 4px rgba(59,130,246,.15); }
  .brand-underline { margin-top: 10px; height: 3px; width: 72px; border-radius: 999px; background: linear-gradient(90deg,#E6F0FF,#BFD7ED); }
  [data-theme="dark"] .brand-underline { background: linear-gradient(90deg,#1e3a5f,#2563eb); }

  /* Sidebar nav items */
  .nav { display: flex; flex-direction: column; gap: 5px; }
  .item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 12px;
    text-decoration: none; color: var(--text); border: 1px solid transparent;
    line-height: 1; transition: background .12s, border-color .12s, color .12s;
    font-weight: 600; font-size: 14px;
  }
  .item:hover { background: var(--hover-bg); border-color: var(--border); }
  .item.active {
    background: var(--active-bg);
    border-color: rgba(0,0,0,.1);
    box-shadow: var(--active-shadow);
    color: ${IOS_BLUE};
  }
  [data-theme="dark"] .item.active { border-color: rgba(59,130,246,.3); }
  .ico svg { width: 20px; height: 20px; color: var(--text-muted); }
  .item.active .ico svg { color: ${IOS_BLUE}; }
  .text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Sidebar section labels */
  .nav-section-label {
    margin: 14px 0 6px 10px; font-size: 10px; font-weight: 800;
    color: var(--text-sub); letter-spacing: 0.8px; text-transform: uppercase;
  }

  /* ===== CARDS ===== */
  .card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px; padding: 16px;
    box-shadow: var(--shadow);
    transition: background .25s, border-color .25s;
  }
  [data-theme="dark"] .card { box-shadow: 0 10px 40px rgba(0,0,0,.4); }

  /* ===== FORM ELEMENTS ===== */
  .input {
    width: 100%; height: 46px;
    border: 1px solid var(--input-border);
    border-radius: 12px; padding: 0 14px;
    outline: none; transition: border-color .12s, box-shadow .12s;
    background: var(--input-bg); color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .input:focus { border-color: var(--ios-blue); box-shadow: 0 0 0 4px rgba(10,132,255,.18); }
  [data-theme="dark"] .input::placeholder { color: var(--text-sub); }
  .label { font-weight: 700; color: var(--text); font-size: 14px; }

  /* ===== BUTTONS ===== */
  .btn {
    height: 44px; border: 0; border-radius: 12px;
    background: var(--ios-blue); color: #fff; font-weight: 800;
    padding: 0 16px; cursor: pointer;
    box-shadow: 0 10px 22px rgba(10,132,255,.25), inset 0 -1px 0 rgba(255,255,255,.25);
  }
  .btn:disabled { filter: grayscale(.1) brightness(.95); opacity: .9; }

  /* ===== STATUS CHIPS ===== */
  .chip { padding: 4px 10px; border-radius: 999px; font-weight: 800; display: inline-block; }
  .chip.waiting { background: #EFF6FF; color: #1E40AF; border: 1px solid #93C5FD; }
  .chip.under   { background: #FFF7ED; color: #9A3412; border: 1px solid #FDBA74; }
  .chip.appr    { background: #ECFDF5; color: #065F46; border: 1px solid #6EE7B7; }
  .chip.rej     { background: #FEF2F2; color: #B91C1C; border: 1px solid #FCA5A5; }
  .pill { padding: 4px 10px; border-radius: 999px; font-weight: 700; display: inline-block; }
  .pill.ok   { background: #ECFDF5; color: #065F46; border: 1px solid #6EE7B7; }
  .pill.warn { background: #FFF7ED; color: #9A3412; border: 1px solid #FDBA74; }
  .pill.over { background: #FEF2F2; color: #B91C1C; border: 1px solid #FCA5A5; }

  /* ===== MOBILE RESPONSIVE ===== */

  /* Hamburger button (hidden on desktop) */
  .btn-hamburger { display: none; }

  /* Mobile overlay backdrop */
  .sidebar-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,.45);
    z-index: 29;
    backdrop-filter: blur(2px);
  }
  .sidebar-overlay.open { display: block; }

  @media (max-width: 768px) {
    /* Show hamburger */
    .btn-hamburger { display: inline-flex; }

    /* Layout: single column */
    .layout { grid-template-columns: 1fr; }

    /* Sidebar: off-canvas drawer */
    .sidebar {
      position: fixed;
      top: 0; left: 0;
      width: 280px;
      height: 100dvh;
      transform: translateX(-100%);
      transition: transform .25s cubic-bezier(.4,0,.2,1), background .25s;
      z-index: 35;
      box-shadow: 4px 0 24px rgba(0,0,0,.18);
    }
    .sidebar.open {
      transform: translateX(0);
    }

    /* Hide user-name on very small screens */
    .user-name { display: none; }

    /* Full width cards */
    .card { border-radius: 12px; }

    /* Main content: less padding */
    .main { padding: 12px 10px; }

    /* Tables: horizontal scroll */
    table { display: block; overflow-x: auto; white-space: nowrap; }

    /* Tables opted into card layout (className="responsive-table") show as stacked cards instead */
    table.responsive-table { display: block; overflow-x: visible; white-space: normal; }
    table.responsive-table thead { display: none; }
    table.responsive-table tbody { display: block; }
    table.responsive-table tr { display: block; margin-bottom: 12px; border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 4px 14px; background: var(--card-bg, #fff); max-width: 100%; overflow: hidden; }
    table.responsive-table td { display: block; width: 100% !important; max-width: 100%; box-sizing: border-box; padding: 10px 0; border: none !important; border-bottom: 1px solid #f1f5f9 !important; text-align: left; white-space: normal; overflow-wrap: break-word; word-break: break-word; }
    table.responsive-table td:last-child { border-bottom: none !important; }
    table.responsive-table td[data-label]::before { content: attr(data-label); display: block; font-weight: 700; color: #64748b; font-size: 12px; margin-bottom: 4px; }
    table.responsive-table td span { white-space: normal !important; }
  }

  @media (max-width: 480px) {
    .topbar { padding: 8px 12px; }
    .brand-img { height: 28px; }
    .main { padding: 10px 8px; }
  }

  /* ==============================================================
     DARK MODE — COMPREHENSIVE OVERRIDES
     หมายเหตุ: Chrome normalize inline color hex → rgb() เสมอ
     ดังนั้นต้องใช้ rgb() ในการ match inline styles
     Background shorthand ("background: #fff") ยังคง hex อยู่
  ============================================================== */

  /* 1. color-scheme: dark → browser renders form elements dark automatically */
  [data-theme="dark"] { color-scheme: dark; }

  /* 2. Native form elements — target by TAG (ไม่ต้อง match inline style) */
  [data-theme="dark"] input,
  [data-theme="dark"] textarea,
  [data-theme="dark"] select,
  [data-theme="dark"] input[type="text"],
  [data-theme="dark"] input[type="email"],
  [data-theme="dark"] input[type="password"],
  [data-theme="dark"] input[type="number"],
  [data-theme="dark"] input[type="date"],
  [data-theme="dark"] input[type="time"],
  [data-theme="dark"] input[type="search"],
  [data-theme="dark"] input[type="url"] {
    background-color: #1e293b !important;
    color: #f1f5f9 !important;
    border-color: #475569 !important;
    color-scheme: dark;
  }
  [data-theme="dark"] input::placeholder,
  [data-theme="dark"] textarea::placeholder { color: #64748b !important; }
  [data-theme="dark"] input:focus,
  [data-theme="dark"] textarea:focus,
  [data-theme="dark"] select:focus {
    border-color: ${IOS_BLUE} !important;
    box-shadow: 0 0 0 3px rgba(10,132,255,.2) !important;
  }
  [data-theme="dark"] input:disabled,
  [data-theme="dark"] textarea:disabled,
  [data-theme="dark"] select:disabled {
    background-color: #0f172a !important;
    color: #475569 !important;
  }
  [data-theme="dark"] input[type="checkbox"],
  [data-theme="dark"] input[type="radio"] {
    accent-color: ${IOS_BLUE};
  }

  /* 3. TEXT COLORS — Chrome ใช้ rgb() สำหรับ longhand color property
        rgb(15,23,42)   = #0f172a
        rgb(30,41,59)   = #1e293b
        rgb(51,65,85)   = #334155
        rgb(55,65,81)   = #374151
        rgb(71,85,105)  = #475569
        rgb(100,116,139)= #64748b
        rgb(17,24,39)   = #111827
  */
  [data-theme="dark"] [style*="rgb(15, 23, 42)"],
  [data-theme="dark"] [style*="rgb(15,23,42)"],
  [data-theme="dark"] [style*="rgb(30, 41, 59)"],
  [data-theme="dark"] [style*="rgb(30,41,59)"],
  [data-theme="dark"] [style*="rgb(51, 65, 85)"],
  [data-theme="dark"] [style*="rgb(51,65,85)"],
  [data-theme="dark"] [style*="rgb(55, 65, 81)"],
  [data-theme="dark"] [style*="rgb(55,65,81)"],
  [data-theme="dark"] [style*="rgb(17, 24, 39)"],
  [data-theme="dark"] [style*="rgb(17,24,39)"] {
    color: #e2e8f0 !important;
  }
  [data-theme="dark"] [style*="rgb(71, 85, 105)"],
  [data-theme="dark"] [style*="rgb(71,85,105)"],
  [data-theme="dark"] [style*="rgb(100, 116, 139)"],
  [data-theme="dark"] [style*="rgb(100,116,139)"] {
    color: #94a3b8 !important;
  }

  /* 4. WHITE / LIGHT BACKGROUNDS — ใช้ hex เพราะ "background" shorthand ไม่ normalize
        แต่ "background-color" normalize เป็น rgb(255,255,255) */
  /* background shorthand keeps hex */
  [data-theme="dark"] [style*="background: #fff"],
  [data-theme="dark"] [style*="background: white"],
  [data-theme="dark"] [style*="background:white"] {
    background: #1e293b !important;
  }
  /* background-color longhand → Chrome normalizes to rgb */
  [data-theme="dark"] [style*="background-color: rgb(255, 255, 255)"],
  [data-theme="dark"] [style*="background-color:rgb(255,255,255)"],
  [data-theme="dark"] [style*="background-color: white"] {
    background-color: #1e293b !important;
  }
  /* Light tones */
  [data-theme="dark"] [style*="background: #f8fafc"],
  [data-theme="dark"] [style*="background: #f1f5f9"],
  [data-theme="dark"] [style*="background: #f9fafb"],
  [data-theme="dark"] [style*="background: #f5f3ff"],
  [data-theme="dark"] [style*="background: #faf5ff"],
  [data-theme="dark"] [style*="background: #f0f9ff"],
  [data-theme="dark"] [style*="background: #EFF6FF"],
  [data-theme="dark"] [style*="background: #eff6ff"],
  [data-theme="dark"] [style*="background: #ecfeff"] {
    background: rgba(255,255,255,.06) !important;
  }
  /* rgba white backgrounds */
  [data-theme="dark"] [style*="background: rgba(255, 255, 255"],
  [data-theme="dark"] [style*="background: rgba(255,255,255"] {
    background: rgba(255,255,255,.08) !important;
  }

  /* 5. SEMANTIC COLOR BOXES — darken but keep hue */
  [data-theme="dark"] [style*="background: #fef2f2"],
  [data-theme="dark"] [style*="background: #fee2e2"] { background: rgba(220,38,38,.15) !important; }
  [data-theme="dark"] [style*="background: #fffbeb"],
  [data-theme="dark"] [style*="background: #fef9c3"],
  [data-theme="dark"] [style*="background: #fef3c7"] { background: rgba(245,158,11,.15) !important; }
  [data-theme="dark"] [style*="background: #f0fdf4"],
  [data-theme="dark"] [style*="background: #dcfce7"],
  [data-theme="dark"] [style*="background: #d1fae5"] { background: rgba(22,163,74,.15) !important; }
  [data-theme="dark"] [style*="background: #e0f2fe"],
  [data-theme="dark"] [style*="background: #dbeafe"] { background: rgba(59,130,246,.15) !important; }
  [data-theme="dark"] [style*="background: #f3e8ff"],
  [data-theme="dark"] [style*="background: #e0e7ff"] { background: rgba(109,40,217,.15) !important; }
  [data-theme="dark"] [style*="background: #ccfbf1"] { background: rgba(13,148,136,.15) !important; }

  /* 6. BORDERS */
  [data-theme="dark"] [style*="border: 1px solid #e2e8f0"],
  [data-theme="dark"] [style*="border: 1px solid rgba(0,0,0"],
  [data-theme="dark"] [style*="border-bottom: 1px solid #e2e8f0"] { border-color: rgba(255,255,255,.1) !important; }

  /* 7. MODALS AND CARDS */
  [data-theme="dark"] .modal-card,
  [data-theme="dark"] .modal-card-split { background: #1e293b !important; color: #f1f5f9 !important; }

  /* 8. TABLES */
  [data-theme="dark"] table { color: #f1f5f9; }
  [data-theme="dark"] thead,
  [data-theme="dark"] thead tr,
  [data-theme="dark"] [style*="background: #f8fafc"],
  [data-theme="dark"] [style*="background: rgb(248, 250, 252)"] { background: #1a2535 !important; }
  [data-theme="dark"] th { color: #94a3b8 !important; border-color: rgba(255,255,255,.08) !important; }
  [data-theme="dark"] td { border-color: rgba(255,255,255,.06) !important; }
  [data-theme="dark"] tr { color: #f1f5f9; }
  [data-theme="dark"] tr:hover { background: rgba(255,255,255,.04) !important; }

  /* 9. TYPOGRAPHY fallback — ใช้ low-specificity เพื่อไม่ override colored elements */
  [data-theme="dark"] :where(h1, h2, h3, h4, h5, h6) { color: #f1f5f9; }
  [data-theme="dark"] :where(p, li, span, div) { color: inherit; }
  [data-theme="dark"] .main { color: #f1f5f9; }
  [data-theme="dark"] label { color: #cbd5e1 !important; }

  /* 10. BUTTONS AND GHOST */
  [data-theme="dark"] .btn-ghost { background: #1e293b !important; color: #e2e8f0 !important; border-color: #475569 !important; }
  [data-theme="dark"] .btn-ghost:hover { background: #334155 !important; }

  /* 11. SCROLLBAR */
  [data-theme="dark"] ::-webkit-scrollbar { width: 6px; height: 6px; }
  [data-theme="dark"] ::-webkit-scrollbar-track { background: #0f172a; }
  [data-theme="dark"] ::-webkit-scrollbar-thumb { background: #334155; border-radius: 999px; }
  [data-theme="dark"] ::-webkit-scrollbar-thumb:hover { background: #475569; }

  /* 12. IFRAME (PDF preview) */
  [data-theme="dark"] iframe { filter: invert(1) hue-rotate(180deg); }

  /* ==============================================================
     13. CLASS-BASED DARK MODE OVERRIDES
     Component-embedded CSS classes use hardcoded light colors.
     These overrides target class names, not inline styles.
  ============================================================== */

  /* ─── Universal card & modal containers ─── */
  [data-theme="dark"] .card,
  [data-theme="dark"] .dash-card,
  [data-theme="dark"] .profile-card,
  [data-theme="dark"] .modal-card,
  [data-theme="dark"] .modal-card-split,
  [data-theme="dark"] .modal-content,
  [data-theme="dark"] .pdf-modal-card,
  [data-theme="dark"] .popup-content {
    background: #1e293b !important;
    color: #f1f5f9 !important;
    border-color: rgba(255,255,255,.08) !important;
  }

  /* ─── Dashboard ─── */
  [data-theme="dark"] .dash-item {
    background: #263248 !important;
    border-color: rgba(255,255,255,.07) !important;
    color: #f1f5f9 !important;
  }
  [data-theme="dark"] .dash-item:hover { background: #2d3b55 !important; }
  [data-theme="dark"] .dash-empty { background: #1a2535 !important; color: #64748b !important; }
  [data-theme="dark"] .dash-title { color: #f1f5f9 !important; }
  [data-theme="dark"] .dash-item-title { color: #e2e8f0 !important; }
  [data-theme="dark"] .dash-item-sub { color: #94a3b8 !important; }
  [data-theme="dark"] .dashboard-header h1 { color: #f1f5f9 !important; }
  [data-theme="dark"] .dashboard-header p { color: #94a3b8 !important; }

  /* ─── Profile / Gateway cards ─── */
  [data-theme="dark"] .profile-title { color: #f1f5f9 !important; }
  [data-theme="dark"] .info-row { border-color: rgba(255,255,255,.05) !important; }
  [data-theme="dark"] .info-row .label { color: #94a3b8 !important; }
  [data-theme="dark"] .info-row .value { color: #e2e8f0 !important; }
  [data-theme="dark"] .divider { background: rgba(255,255,255,.08) !important; }
  [data-theme="dark"] .header-card { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important; }

  /* ─── Table cells ─── */
  [data-theme="dark"] td {
    background: #1e293b !important;
    color: #f1f5f9 !important;
    border-color: rgba(255,255,255,.06) !important;
  }
  [data-theme="dark"] .row-even { background: #1e293b !important; color: #f1f5f9 !important; }
  [data-theme="dark"] .row-odd { background: #1a2535 !important; color: #f1f5f9 !important; }
  [data-theme="dark"] .student-table td { background: #1e293b !important; border-color: rgba(255,255,255,.06) !important; }
  [data-theme="dark"] .student-row:hover td { background: #263248 !important; }

  /* ─── Buttons ─── */
  [data-theme="dark"] .btn-ghost {
    background: #1e293b !important;
    color: #e2e8f0 !important;
    border-color: #475569 !important;
  }
  [data-theme="dark"] .btn-ghost:hover { background: #334155 !important; }
  [data-theme="dark"] .btn-secondary {
    background: #334155 !important;
    color: #e2e8f0 !important;
    border-color: #475569 !important;
  }
  [data-theme="dark"] .btn-secondary:hover { background: #475569 !important; }
  [data-theme="dark"] .btn-outline {
    background: #1e293b !important;
    color: #60a5fa !important;
    border-color: #3b82f6 !important;
  }
  [data-theme="dark"] .btn-outline:hover { background: rgba(59,130,246,.15) !important; }
  [data-theme="dark"] .action-btn {
    background: #1e293b !important;
    color: #e2e8f0 !important;
    border-color: #475569 !important;
  }
  [data-theme="dark"] .action-btn:hover { background: #334155 !important; }
  [data-theme="dark"] .btn-delete {
    background: rgba(220,38,38,.2) !important;
    border-color: rgba(220,38,38,.4) !important;
    color: #fca5a5 !important;
  }
  [data-theme="dark"] .btn-link { color: #60a5fa !important; }

  /* ─── Modal inner elements ─── */
  [data-theme="dark"] .modal-header {
    background: #1e293b !important;
    border-color: rgba(255,255,255,.08) !important;
    color: #f1f5f9 !important;
  }
  [data-theme="dark"] .modal-body { background: #1e293b !important; color: #e2e8f0 !important; }
  [data-theme="dark"] .pdf-modal-header {
    background: #1e293b !important;
    border-color: rgba(255,255,255,.08) !important;
    color: #f1f5f9 !important;
  }
  [data-theme="dark"] .close-btn { background: #334155 !important; color: #94a3b8 !important; }

  /* ─── Form variants ─── */
  [data-theme="dark"] .input.soft { background: #1a2535 !important; }
  [data-theme="dark"] .file-item {
    background: #263248 !important;
    border-color: rgba(255,255,255,.08) !important;
    color: #e2e8f0 !important;
  }

  /* ─── Status chips ─── */
  [data-theme="dark"] .chip.waiting { background: #1a2535 !important; color: #94a3b8 !important; border-color: rgba(255,255,255,.1) !important; }
  [data-theme="dark"] .chip.edit { background: rgba(194,65,12,.2) !important; color: #fb923c !important; border-color: rgba(194,65,12,.3) !important; }

  /* ─── StatusTracker step icons ─── */
  [data-theme="dark"] .step-icon { background: #1e293b !important; }
  [data-theme="dark"] .step-icon.waiting { background: #1a2535 !important; }

  /* ─── Supervision checkboxes ─── */
  [data-theme="dark"] .teacher-checkbox-grid { background: #1a2535 !important; border-color: rgba(255,255,255,.08) !important; }
  [data-theme="dark"] .teacher-checkbox-label { background: #1e293b !important; border-color: #475569 !important; color: #e2e8f0 !important; }
  [data-theme="dark"] .teacher-checkbox-label:hover { background: #334155 !important; }

  /* ─── Attachment links ─── */
  [data-theme="dark"] .attachment-link {
    background: #1a2535 !important;
    color: #38bdf8 !important;
    border-color: rgba(255,255,255,.1) !important;
  }
  [data-theme="dark"] .attachment-link:hover { background: #263248 !important; }

  /* ─── Topbar & icon buttons (M_App.tsx overrides with #fff; need !important to win) ─── */
  [data-theme="dark"] .topbar {
    background: var(--topbar-bg) !important;
    border-color: var(--border) !important;
    color: var(--text) !important;
  }
  [data-theme="dark"] .btn-ico {
    background: var(--surface) !important;
    color: var(--text) !important;
    border-color: var(--border) !important;
  }
  [data-theme="dark"] .btn-ico:hover { background: var(--hover-bg) !important; }

  /* ─── Login page ─── */
  [data-theme="dark"] .panel-right { background: #1e293b !important; color: #f1f5f9 !important; }
  [data-theme="dark"] .seg.active { background: #334155 !important; color: #f1f5f9 !important; box-shadow: none !important; }

  /* ─── Tab buttons (T_Students modal) ─── */
  [data-theme="dark"] .tab-btn { background: #1a2535 !important; color: #94a3b8 !important; border-color: rgba(255,255,255,.08) !important; }
  [data-theme="dark"] .tab-btn.active,
  [data-theme="dark"] .tab-btn:hover { background: #334155 !important; color: #f1f5f9 !important; }

  /* ==============================================================
     14. MISSING INLINE-STYLE HEX OVERRIDES
     background: #ffffff (6-digit) is different string from #fff
  ============================================================== */
  [data-theme="dark"] [style*="background: #ffffff"],
  [data-theme="dark"] [style*="background:#ffffff"] { background: #1e293b !important; }

  /* background-color longhand (rgb) for light gray tones */
  [data-theme="dark"] [style*="background-color: rgb(248, 250, 252)"],
  [data-theme="dark"] [style*="background-color: rgb(241, 245, 249)"],
  [data-theme="dark"] [style*="background-color: rgb(249, 250, 251)"],
  [data-theme="dark"] [style*="background-color: rgb(243, 244, 246)"],
  [data-theme="dark"] [style*="background-color: rgb(226, 232, 240)"],
  [data-theme="dark"] [style*="background-color: rgb(240, 249, 255)"] {
    background-color: #1a2535 !important;
  }

  /* background shorthand for additional light tones */
  [data-theme="dark"] [style*="background: #f0fdf4"],
  [data-theme="dark"] [style*="background: #fff7ed"],
  [data-theme="dark"] [style*="background: #ecfdf5"],
  [data-theme="dark"] [style*="background: #fafafa"] { background: rgba(255,255,255,.05) !important; }

  /* ==============================================================
     15. RGB VARIANTS — for when Chrome normalizes background shorthand hex→rgb
     Some Chrome versions serialize "background: #fff" → "background: rgb(255,255,255)"
  ============================================================== */
  [data-theme="dark"] [style*="background: rgb(255, 255, 255)"],
  [data-theme="dark"] [style*="background:rgb(255,255,255)"] { background: #1e293b !important; }

  [data-theme="dark"] [style*="background: rgb(248, 250, 252)"],
  [data-theme="dark"] [style*="background: rgb(241, 245, 249)"],
  [data-theme="dark"] [style*="background: rgb(249, 250, 251)"],
  [data-theme="dark"] [style*="background: rgb(243, 244, 246)"],
  [data-theme="dark"] [style*="background: rgb(240, 253, 244)"],
  [data-theme="dark"] [style*="background: rgb(236, 253, 245)"] { background: #1a2535 !important; }

  /* ==============================================================
     16. DOC PAGE SPECIFIC CLASS OVERRIDES
     Classes defined in S_DocT005_006, S_DocT007, S_DocT008, etc.
  ============================================================== */

  /* ─── Colored background classes (doc pages) ─── */
  [data-theme="dark"] .bg-green { background: rgba(22,163,74,.2) !important; color: #86efac !important; }
  [data-theme="dark"] .bg-blue { background: rgba(59,130,246,.2) !important; color: #93c5fd !important; }
  [data-theme="dark"] .bg-yellow { background: rgba(245,158,11,.2) !important; color: #fcd34d !important; }
  [data-theme="dark"] .bg-purple { background: rgba(109,40,217,.2) !important; color: #c4b5fd !important; }

  /* ─── URL container (doc sharing pages) ─── */
  [data-theme="dark"] .url-container {
    background: #1a2535 !important;
    border-color: rgba(255,255,255,.1) !important;
    color: #e2e8f0 !important;
  }

  /* ─── Copy button ─── */
  [data-theme="dark"] .btn-copy {
    background: #334155 !important;
    color: #e2e8f0 !important;
    border-color: #475569 !important;
  }
  [data-theme="dark"] .btn-copy:hover { background: #475569 !important; }
  [data-theme="dark"] .btn-copy.copied { background: rgba(22,163,74,.25) !important; color: #86efac !important; }

  /* ─── Email pill ─── */
  [data-theme="dark"] .email-pill {
    background: rgba(59,130,246,.15) !important;
    border-color: rgba(59,130,246,.3) !important;
    color: #93c5fd !important;
  }

  /* ─── Profile sub text ─── */
  [data-theme="dark"] .profile-sub { color: #94a3b8 !important; }

  /* ─── Section dividers ─── */
  [data-theme="dark"] .divider { background: rgba(255,255,255,.1) !important; }

  /* ─── Link box (doc pages) ─── */
  [data-theme="dark"] .link-box { background: rgba(255,255,255,.04) !important; border-color: rgba(255,255,255,.1) !important; }

  /* ─── A_Students.tsx sectionCard ─── */
  [data-theme="dark"] [style*="background: #f8fafc"] { background: #1a2535 !important; }

  /* ─── Step icon semantic colors ─── */
  [data-theme="dark"] .step-icon.completed { background: rgba(22,163,74,.2) !important; }
  [data-theme="dark"] .step-icon.progress { background: rgba(59,130,246,.2) !important; }
  [data-theme="dark"] .step-icon.warning { background: rgba(245,158,11,.2) !important; }

  /* ─── Tab menu items (A_DocT002Review, A_DocT003Review, etc.) ─── */
  [data-theme="dark"] .tab { background: #1a2535 !important; color: #94a3b8 !important; border-color: rgba(255,255,255,.08) !important; }
  [data-theme="dark"] .tab.active,
  [data-theme="dark"] .tab:hover { background: #334155 !important; color: #f1f5f9 !important; }

  /* ─── Form section wrappers (S_DocsT002Form, S_DocsT003Form) ─── */
  [data-theme="dark"] [style*="background: #ecfdf5"] { background: rgba(22,163,74,.12) !important; }
  [data-theme="dark"] [style*="background: #bae6fd"] { background: rgba(14,165,233,.25) !important; }
  [data-theme="dark"] [style*="background: #e0f2fe"] { background: rgba(14,165,233,.12) !important; }
  [data-theme="dark"] [style*="background: #f0fdfa"] { background: rgba(20,184,166,.12) !important; }
  [data-theme="dark"] [style*="background: #ede9fe"] { background: rgba(109,40,217,.15) !important; }
  [data-theme="dark"] [style*="background: #fefce8"] { background: rgba(234,179,8,.1) !important; }
  [data-theme="dark"] [style*="background: #fde047"] { background: rgba(234,179,8,.3) !important; }
  [data-theme="dark"] [style*="background: #fef9c3"] { background: rgba(234,179,8,.1) !important; }

  /* ─── Table cells in T003 work plan (alternating) ─── */
  [data-theme="dark"] [style*="background: #525659"] { background: #1a2535 !important; }
  `;
}
