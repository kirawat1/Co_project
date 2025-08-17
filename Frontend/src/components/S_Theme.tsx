// src/components/StudentTheme.tsx
export default function StudentTheme({ IOS_BLUE = "#0074B7" }: { IOS_BLUE?: string }) {
  return <style>{css(IOS_BLUE)}</style>;
}
function css(IOS_BLUE: string) {
  return `
  :root { 
    --ios-blue:${IOS_BLUE}; 
    --shadow:0 10px 40px rgba(10,132,255,.15);
    --font-ui: "Inter Variable","Noto Sans Thai Variable","Inter","Noto Sans Thai",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  }
  .app-bg{ min-height:100dvh; background: radial-gradient(1200px 700px at 80% -10%, #E6F0FF 0%, #F7FAFF 40%, #FFFFFF 100%); }
  body, .app-bg, .sidebar, .main, .card, .btn, .input, .label { 
    font-family: var(--font-ui);
    line-height: 1.55;
    letter-spacing: .1px;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }
  input,button,select,textarea{ font: inherit }
  .topbar{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#fff; border-bottom:1px solid rgba(0,0,0,.06); position:sticky; top:0; z-index:10; }
  .brand-badge{ background:#BFD7ED; padding:6px 10px; border-radius:10px; display:inline-flex; align-items:center; box-shadow:0 6px 18px rgba(10,132,255,.18) }
  .brand-img{ height:20px; display:block; object-fit:contain }
  .user-mini{ display:flex; align-items:center; gap:10px; color:#374151 } .user-ava{ width:28px; height:28px; border-radius:8px; background:#e5e7eb }
  .layout{ display:grid; grid-template-columns:240px 1fr; min-height:calc(100dvh - 52px); } .main{ min-width:0; padding:16px; }
  @media (max-width:900px){ .layout{ grid-template-columns:1fr } }
  .sidebar{ width:240px; background:rgba(255,255,255,.8); backdrop-filter: blur(6px); border-right:1px solid rgba(0,0,0,.06); padding:20px 16px; position:sticky; top:52px; height:calc(100dvh - 52px); }
  .brand-text{ font-weight:900; color:var(--ios-blue); margin-bottom:14px; letter-spacing:.3px }
  .nav{ display:flex; flex-direction:column; gap:6px }
  .nav .item{ display:block; padding:10px 12px; border-radius:10px; color:#374151; text-decoration:none }
  .nav .item:hover{ background:#f3f4f6 }
  .nav .item.active{ background:#fff; color:#111827; box-shadow:0 6px 18px rgba(10,132,255,.18); border:1px solid rgba(10,132,255,.18) }
  @media (max-width:900px){ .sidebar{ width:100%; height:auto; position:static; border-right:0; border-bottom:1px solid rgba(0,0,0,.06); top:0 } .nav{ flex-direction:row; overflow:auto } }
  .card{ background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:16px; padding:16px; box-shadow: var(--shadow) }
  .btn{ height:44px; border:0; border-radius:12px; background:var(--ios-blue); color:#fff; font-weight:800; padding:0 16px; box-shadow:0 10px 22px rgba(10,132,255,.25), inset 0 -1px 0 rgba(255,255,255,.25); cursor:pointer }
  .btn:disabled{ filter:grayscale(.1) brightness(.95); opacity:.9 }
  .input{ width:100%; height:46px; border:1px solid #e5e7eb; border-radius:12px; padding:0 14px; outline:none; transition:border-color .12s, box-shadow .12s; background:#fff; font-variant-numeric: tabular-nums; }
  .input:focus{ border-color:var(--ios-blue); box-shadow:0 0 0 4px rgba(10,132,255,.18) }
  .label{ font-weight:700; color:#111827; font-size:14px }
  .chip{ padding:4px 10px; border-radius:999px; font-weight:800; display:inline-block }
  .chip.waiting{ background:#EFF6FF; color:#1E40AF; border:1px solid #93C5FD }
  .chip.under{   background:#FFF7ED; color:#9A3412; border:1px solid #FDBA74 }
  .chip.appr{    background:#ECFDF5; color:#065F46; border:1px solid #6EE7B7 }
  .chip.rej{     background:#FEF2F2; color:#B91C1C; border:1px solid #FCA5A5 }
  .pill{ padding:4px 10px; border-radius:999px; font-weight:700; display:inline-block }
  .pill.ok{   background:#ECFDF5; color:#065F46; border:1px solid #6EE7B7 }
  .pill.warn{ background:#FFF7ED; color:#9A3412;  border:1px solid #FDBA74 }
  .pill.over{ background:#FEF2F2; color:#B91C1C;  border:1px solid #FCA5A5 }
  `;
}
