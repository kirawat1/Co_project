import React, { useMemo } from "react";



function useMentorData() {
  type S = { studentId: string, firstName: string, lastName: string };
  const students: S[] = (() => { try { return JSON.parse(localStorage.getItem("coop.mentor.students") || "[]") } catch { return [] } })();
  function lastLogDate(stdId: string) {
    try {
      const logs = JSON.parse(localStorage.getItem(`coop.mentor.logs.${stdId}`) || "[]") as { date: string, createdAt: string }[];
      if (!logs.length) return "—";
      const latest = logs.map(l => l.createdAt || l.date).sort().pop()!;
      return new Date(latest).toLocaleString();
    } catch { return "—" }
  }
  return { students, lastLogDate };
}

export default function MentorDashboard() {
  const { students, lastLogDate } = useMentorData();
  const total = students.length;

  const cards = useMemo(() => [
    { id: "c1", title: "จำนวนนักศึกษาที่ดูแล", value: String(total), icon: UsersIcon },
  ], [total]);

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>ภาพรวม</h2>
        <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(200px,1fr))", gap: 12, marginLeft: 8 }}>
          {cards.map(c => {
            const Ico = c.icon;
            return (
              <div key={c.id} className="card" style={{ padding: 16, width: 200, display: "flex", gap: 12, alignItems: "center" }}>
                <span className="ico-box"><Ico /></span>
                <div>
                  <div style={{ color: "#6b7280", fontWeight: 700 }}>{c.title}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{c.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>นักศึกษาที่ดูแล</h2>
        <table className="doc-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th align="left">รหัส</th>
              <th align="left">ชื่อ-นามสกุล</th>
              <th align="left">อัปเดตล่าสุด</th>
              <th align="left">การทำงาน</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.studentId} className="row">
                <td>{s.studentId}</td>
                <td>{s.firstName} {s.lastName}</td>
                <td style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ClockIcon /> {lastLogDate(s.studentId)}
                </td>
                <td>
                  <a className="btn btn-with-ico" href={`/mentor/daily?student=${encodeURIComponent(s.studentId)}`}>
                    <BookIcon /> บันทึกประจำวัน
                  </a>
                </td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={4} style={{ color: "#6b7280" }}>— ยังไม่เพิ่มนักศึกษา —</td></tr>}
          </tbody>
        </table>
      </section>

      <style>{`
        .ico-box{
          width:40px; height:40px; border-radius:12px;
          background:#E6F0FF; color:#0f172a;
          display:inline-flex; align-items:center; justify-content:center;
          border:1px solid rgba(0,0,0,.06);
        }
        .ico-box svg{ width:22px; height:22px; }

        .btn-with-ico{
          display:inline-flex; align-items:center; gap:8px;
        }
        .btn-with-ico svg{ width:18px; height:18px; }

        .doc-table{ border-collapse:separate; border-spacing:0; }
        .doc-table th, .doc-table td{ padding:10px 12px; border-bottom:1px solid rgba(0,0,0,.06) }
        .row:hover td{ background:#fcfcff }
        @media (max-width:1024px){ .grid{ grid-template-columns:1fr !important } }
      `}</style>
    </div>
  );
}

/* ===== SVG Icons (เบา ๆ ไม่ใช้ไลบรารีเพิ่ม) ===== */
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
