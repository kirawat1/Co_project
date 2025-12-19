import React, { useEffect, useMemo, useState } from "react";
import type { StudentProfile, DailyLog } from "./store";
import { loadDaily, saveDaily } from "./store";

/* =========================
   Constants
========================= */
const GLOBAL_KEY = "coop.student.daily.v1";

/* =========================
   Date / Week Helpers
========================= */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// วันจันทร์ของสัปดาห์
function getWeekStart(dateISO: string) {
  const d = new Date(dateISO);
  const day = d.getDay() || 7; // อา.=7
  if (day !== 1) d.setDate(d.getDate() - (day - 1));
  return d;
}

// key กลุ่มสัปดาห์
function getWeekKey(dateISO: string) {
  const d = getWeekStart(dateISO);
  const year = d.getFullYear();
  const firstJan = new Date(year, 0, 1);
  const week =
    Math.ceil(((+d - +firstJan) / 86400000 + firstJan.getDay() + 1) / 7) || 1;
  return `${year}-W${week}`;
}

// label สัปดาห์
function weekLabel(dateISO: string) {
  const start = getWeekStart(dateISO);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `สัปดาห์ ${fmtDate(start.toISOString().slice(0, 10))} – ${fmtDate(
    end.toISOString().slice(0, 10)
  )}`;
}

/* =========================
   Storage Helpers
========================= */
function loadGlobal(): DailyLog[] {
  try {
    return JSON.parse(localStorage.getItem(GLOBAL_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveGlobal(all: DailyLog[]) {
  localStorage.setItem(GLOBAL_KEY, JSON.stringify(all));
}

/* =========================
   Component
========================= */
export default function S_DailyPage({ profile }: { profile: StudentProfile }) {
  const studentId = profile.studentId;

  const [logs, setLogs] = useState<DailyLog[]>(() => loadDaily(studentId));

  const date = todayISO();

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  /* ---------- persist per student ---------- */
  useEffect(() => {
    saveDaily(studentId, logs);
  }, [logs, studentId]);

  /* ---------- lock duplicate day ---------- */
  const alreadyLoggedToday = useMemo(
    () => logs.some((l) => l.date === date),
    [logs, date]
  );

  const canSubmit = useMemo(
    () => Boolean(checkIn && checkOut && !alreadyLoggedToday),
    [checkIn, checkOut, alreadyLoggedToday]
  );

  /* ---------- group by week ---------- */
  const logsByWeek = useMemo(() => {
    const map: Record<string, DailyLog[]> = {};
    logs.forEach((l) => {
      const key = getWeekKey(l.date);
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });

    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.date.localeCompare(b.date))
    );

    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  function addLog(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const item: DailyLog = {
      id: crypto.randomUUID(),
      studentId,
      studentName:
        `${profile.firstName} ${profile.lastName}`.trim() || "นักศึกษา",
      date,
      checkIn,
      checkOut,
      note,
      status: submitted ? "submitted" : "draft",
      createdAt: new Date().toISOString(),
      submittedAt: submitted ? new Date().toISOString() : undefined,
    };

    const next = [...logs, item];
    setLogs(next);
    saveGlobal([...loadGlobal(), item]);

    setCheckIn("");
    setCheckOut("");
    setNote("");
    setSubmitted(false);
  }

  return (
    <div className="page" style={{ padding: 4, margin: 36, marginLeft: 65 }}>
      {/* ================= FORM ================= */}
      <form
        className="card daily-card"
        onSubmit={addLog}
        style={{ padding: "0 2em" }}
      >
        <h2 className="daily-title">บันทึกการทำงานประจำวัน</h2>

        <div className="field" style={{ width: "20%" }}>
          <label className="label">วันที่ทำงาน</label>
          <input className="input soft" value={fmtDate(date)} disabled />
        </div>

        <div className="grid-form">
          <div className="field" style={{ width: "91%" }}>
            <label className="label">ชื่อผู้บันทึก</label>
            <input
              className="input soft"
              value={`${profile.firstName} ${profile.lastName}`}
              disabled
            />
          </div>

          <div className="field" style={{ width: "91%" }}>
            <label className="label">เวลาเข้า</label>
            <input
              className="input"
              type="time"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              disabled={alreadyLoggedToday}
            />
          </div>

          <div className="field" style={{ width: "91%" }}>
            <label className="label">เวลาออก</label>
            <input
              className="input"
              type="time"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              disabled={alreadyLoggedToday}
            />
          </div>
        </div>

        <div className="field" style={{ width: "97%" }}>
          <label className="label">สรุปงาน / สิ่งที่ทำ</label>
          <textarea
            className="input"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={alreadyLoggedToday}
          />
        </div>

        <div className="submit-box" style={{ width: "15%" }}>
          <label className="submit-check">
            <input
              type="checkbox"
              checked={submitted}
              onChange={(e) => setSubmitted(e.target.checked)}
              disabled={alreadyLoggedToday}
            />
            ส่งบันทึก (Submitted)
          </label>
          <p className="hint">หากส่งแล้วจะไม่สามารถแก้ไขข้อมูลได้</p>
        </div>

        <div className="actions">
          <button className="btn" disabled={!canSubmit}>
            บันทึก
          </button>
        </div>

        {alreadyLoggedToday && (
          <p className="warn">⚠️ วันนี้คุณได้บันทึกไปแล้ว</p>
        )}
      </form>

      {/* ================= WEEKLY TABLE ================= */}
      <section className="card" style={{ marginTop: 22 }}>
        <h2>ประวัติการบันทึก (แยกตามสัปดาห์)</h2>

        {logsByWeek.map(([week, items]) => (
          <div key={week} style={{ marginTop: 18 }}>
            <div className="week-title">📅 {weekLabel(items[0].date)}</div>

            <table className="daily-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>เข้า</th>
                  <th>ออก</th>
                  <th>สรุปงาน</th>
                  <th>สถานะ</th>
                  <th>วันที่เพิ่ม</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id}>
                    <td>{fmtDate(l.date)}</td>
                    <td>{l.checkIn}</td>
                    <td>{l.checkOut}</td>
                    <td style={{ whiteSpace: "pre-line" }}>{l.note || "-"}</td>
                    <td>
                      <span className={`pill ${l.status}`}>
                        {l.status === "draft" ? "Draft" : "Submitted"}
                      </span>
                    </td>
                    <td>
                      {l.createdAt
                        ? new Date(l.createdAt).toLocaleString("th-TH")
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {logs.length === 0 && (
          <p style={{ color: "#6b7280", marginTop: 12 }}>ยังไม่มีบันทึก</p>
        )}
      </section>

      {/* ================= STYLE ================= */}
      <style>{`
        .daily-card{ padding:24px }
        .daily-title{ font-size:20px; font-weight:800 }
        .field{ margin-bottom:14px , }
        .grid-form{ display:grid; grid-template-columns:1.2fr 1fr 1fr; gap:16px }
        .input.soft{ background:#f9fafb }

        .submit-box{
          margin:18px 0;
          padding:14px 16px;
          border-radius:14px;
          background:#f8fafc;
          border:1px solid #e5e7eb;
        }
        .submit-check{
          display:flex; align-items:center; gap:10px;
          font-weight:700;
        }
        .hint{ margin:6px 0 0 28px; font-size:13px; color:#6b7280 }
        .actions{ display:flex; justify-content:flex-end }
        .warn{ margin-top:12px; color:#b91c1c }

        .week-title{
          font-weight:800;
          margin-bottom:8px;
          color:#0f172a;
        }

        .daily-table{
          width:100%;
          border-collapse:separate;
          border-spacing:0 10px;
        }
        .daily-table th{ font-size:13px; color:#6b7280 }
        .daily-table td{
          background:#fff;
          border:1px solid #e5e7eb;
          padding:12px;
        }
        .daily-table td:first-child{ border-radius:12px 0 0 12px }
        .daily-table td:last-child{ border-radius:0 12px 12px 0 }

        .pill{
          padding:4px 12px;
          border-radius:999px;
          font-size:12px;
          font-weight:700;
        }
        .pill.draft{
          background:#fff7ed; color:#9a3412; border:1px solid #fdba74;
        }
        .pill.submitted{
          background:#ecfdf5; color:#065f46; border:1px solid #6ee7b7;
        }

        @media(max-width:1024px){
          .grid-form{ grid-template-columns:1fr }
          .actions .btn{ width:100% }
        }
      `}</style>
    </div>
  );
}

/* =========================
   Date Format
========================= */
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const MM = [
    "ม.ค",
    "ก.พ",
    "มี.ค",
    "เม.ย",
    "พ.ค",
    "มิ.ย",
    "ก.ค",
    "ส.ค",
    "ก.ย",
    "ต.ค",
    "พ.ย",
    "ธ.ค",
  ];
  return `${d} ${MM[m - 1]} ${y + 543}`;
}
