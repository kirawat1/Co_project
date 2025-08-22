import { useMemo } from "react";
import type { StudentProfile } from "./store";

// ✅ อ่านประกาศจากแอดมินที่ key นี้ ถ้าไม่มีจะ fallback เป็นรายการตัวอย่างเดิม
function loadAdminAnns(){
  try{ return JSON.parse(localStorage.getItem("coop.shared.announcements") || "[]"); }
  catch{ return []; }
}

type Ann = { id:string; title:string; date:string; body?:string };

export default function DashboardPage({ profile }: { profile: StudentProfile }) {
  const todayISO = new Date().toISOString().slice(0, 10);

  // เอกสารเรียงตามกำหนดส่ง + คำนวณจำนวนวัน
  const upcoming = useMemo(() => {
    const startOfToday = () => {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      return t;
    };
    const toDays = (iso: string) => {
      const t = startOfToday();
      const d = new Date(iso + "T00:00:00");
      return Math.round((d.getTime() - t.getTime()) / 86400000);
    };
    return [...profile.docs]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((d) => ({ ...d, days: toDays(d.dueDate) }));
  }, [profile.docs]);

  // ✅ ประกาศ: โหลดจากแอดมิน → ถ้าไม่มี ใช้รายการเดิม → ซ่อนเกินกำหนด → เรียงตามวัน
  const announcements = useMemo(() => {
    const fromAdmin: Ann[] = loadAdminAnns();
    const fallback: Ann[] = [
      { id: "a1", title: "กำหนดส่งแบบคำร้องสหกิจ 1/2568", date: "2025-09-05", body: "ส่งผ่านระบบภายใน 23:59 น." },
      { id: "a2", title: "อบรมเตรียมความพร้อมก่อนออกฝึก", date: "2025-09-10", body: "ห้อง CC-201 เวลา 09:00-12:00 น." },
    ];
    const base = (fromAdmin && fromAdmin.length) ? fromAdmin : fallback;
    return base
      .filter((a) => a.date >= todayISO)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [todayISO]);

  return (
    <div className="page" style={{ padding: 4, margin: 28 }}>
      <div className="card" style={{ marginBottom: 40, marginLeft: 30, paddingLeft: 30, paddingTop: 5, paddingBottom: 30 }}>
        <h2>กำหนดส่งเอกสาร</h2>
        <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 20 }}>
          {upcoming.map((u) => (
            <div className="card" key={u.id} style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, marginLeft: 15 }}>{u.title}</div>

              {/* ชิพวันคงเหลือพร้อมสีตามเกณฑ์ */}
              <div className={`chip ${chipClass(u.days)}`} style={{ marginTop: 6, fontSize: 14, fontWeight: 700, marginLeft: 15 }}>
                {fmtDate(u.dueDate)} · {humanDays(u.days)}
              </div>

              {/* สีสถานะให้เข้ากันกับตารางส่งเอกสาร */}
              <div style={{ color: "#374151", marginTop: 6, marginLeft: 15 }}>
                สถานะ : <span className={`st ${statusClass(u.status)}`}>{statusTH(u.status)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginLeft: 30, paddingLeft: 30, paddingTop: 5, paddingBottom: 30 }}>
        <h2>ประกาศสหกิจศึกษา</h2>
        <ul style={{ margin: 0, marginRight: 30, padding: 0, listStyle: "none" }}>
          {announcements.map((a) => (
            <li key={a.id} style={{ padding: "10px 0", borderBottom: "1px dashed #e5e7eb" }}>
              <div style={{ fontWeight: 800 }}>{a.title}</div>
              <div style={{ color: "#6b7280", fontSize: 14 }}>
                {fmtDate(a.date)} · {a.body || "-"}
              </div>
            </li>
          ))}
          {announcements.length === 0 && (
            <li style={{ padding: "10px 0", color: "#6b7280" }}>— ไม่มีประกาศในช่วงนี้ —</li>
          )}
        </ul>
      </div>

      {/* สไตล์เฉพาะหน้า Dashboard (scoped ด้วย .page) */}
      <style>{dashCss()}</style>
    </div>
  );
}

/* ---------- Helpers ---------- */
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString();
const humanDays = (d: number) => (d < 0 ? `เลยกำหนด ${Math.abs(d)} วัน` : d === 0 ? "ครบกำหนดวันนี้" : `อีก ${d} วัน`);

// สีชิพตามเกณฑ์: overdue(เลยกำหนด)=แดงเข้ม, ≤7=แดง, 8–20=เหลือง, ≥21=เขียว
const chipClass = (d: number) => (d < 0 ? "chip-over" : d <= 7 ? "chip-red" : d <= 20 ? "chip-yellow" : "chip-green");

// สีสถานะให้ตรงกับตารางเอกสาร: waiting(เทา) / under-review(คราม) / approved(เขียว) / rejected(แดง)
const statusTH = (s: string) =>
  s === "waiting" ? "รอส่งเอกสาร" : s === "under-review" ? "รอพิจารณา" : s === "approved" ? "ผ่าน" : "ไม่ผ่าน";
const statusClass = (s: string) =>
  s === "waiting" ? "st-waiting" : s === "under-review" ? "st-under" : s === "approved" ? "st-pass" : "st-fail";

/* ---------- Scoped CSS ---------- */
function dashCss() {
  return `
  .page .chip{
    display:inline-block; padding:4px 10px; border-radius:999px; border:1px solid;
  }
  .page .chip-over   { background:#fee2e2; color:#7f1d1d; border-color:#fecaca; }  /* เลยกำหนด */
  .page .chip-red    { background:#fef2f2; color:#991b1b; border-color:#fecaca; }  /* ≤ 7 วัน */
  .page .chip-yellow { background:#fef9c3; color:#854d0e; border-color:#fde68a; }  /* 8–20 วัน */
  .page .chip-green  { background:#ecfdf5; color:#065f46; border-color:#a7f3d0; }  /* ≥ 21 วัน */

  .page .st { font-weight:800; }
  .page .st-waiting { color:#6b7280; }   /* เทา */
  .page .st-under   { color:#4f46e5; }   /* คราม/Indigo */
  .page .st-pass    { color:#16a34a; }   /* เขียว */
  .page .st-fail    { color:#dc2626; }   /* แดง */
  `;
}
