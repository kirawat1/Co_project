// src/components/A_Daily.tsx
import { useMemo, useState } from "react";
import type { DailyLog } from "./store";

/* โหลดข้อมูลทั้งหมดจาก v1 */
function loadDaily(): DailyLog[] {
  try {
    return JSON.parse(localStorage.getItem("coop.student.daily.v1") || "[]") || [];
  } catch {
    return [];
  }
}

export default function A_Daily() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const all: DailyLog[] = loadDaily();
    const needle = q.trim().toLowerCase();
    return all.filter((l) =>
      `${l.studentId} ${l.studentName || ""}`
        .toLowerCase()
        .includes(needle)
    );
  }, [q]);

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 20, marginBottom: 28 }}>
        <h2 style={{ marginBottom: 12 }}>บันทึกการทำงานนักศึกษา (ทั้งหมด)</h2>
        <div
          className="tools"
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}
        >
          <input
            className="input"
            placeholder="ค้นหา: รหัส / ชื่อนักศึกษา / พี่เลี้ยง"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: "0 1 420px", minWidth: 260 }}
          />
        </div>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>วันที่ทำงาน</th>
              <th>รหัส</th>
              <th>ชื่อนักศึกษา</th>
              <th>พี่เลี้ยง</th>
              <th>เข้า</th>
              <th>ออก</th>
              <th>สรุปงาน</th>
              <th>ลายเซ็น นศ.</th>
              <th>ลายเซ็น พี่เลี้ยง</th>
              <th>วันที่เพิ่ม</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>{fmtDate(l.date)}</td>
                <td>{l.studentId}</td>
                <td>{l.studentName || "-"}</td>
                <td>{l.checkIn}</td>
                <td>{l.checkOut}</td>
                <td className="note">{l.note || "-"}</td>
                <td>
                  {l.signature ? (
                    <img
                      src={l.signature}
                      alt="sign-student"
                      style={{ height: 36, maxWidth: 200, objectFit: "contain" }}
                    />
                  ) : (
                    <span style={{ color: "#6b7280" }}>-</span>
                  )}
                </td>
                <td>
                  {l.mentorSignature ? (
                    <img
                      src={l.mentorSignature}
                      alt="sign-mentor"
                      style={{ height: 36, maxWidth: 200, objectFit: "contain" }}
                    />
                  ) : (
                    <span style={{ color: "#dc2626" }}>ยังไม่เซ็น</span>
                  )}
                </td>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ color: "#6b7280" }}>
                  — ไม่มีข้อมูล —
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <style>{`
          .tbl{ width:100%; border-collapse:separate; border-spacing:0 8px }
          th{ text-align:left; font-size:13px; color:#6b7280; font-weight:700; padding:0 10px }
          td{ background:#fff; border:1px solid #e5e7eb; padding:10px; vertical-align:middle }
          td:first-child{ border-radius:12px 0 0 12px }
          td:last-child{ border-radius:0 12px 12px 0 }
          .note{ max-width:360px; white-space:pre-line }
        `}</style>
      </section>
    </div>
  );
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const TH_MONTH = ["ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย", "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค"];
  return `${d} ${TH_MONTH[m - 1]} ${y + 543}`;
};
