// src/components/M_Students.tsx
import React, { useEffect, useMemo, useState } from "react";

/** ใช้แสดงเฉพาะ: ชื่อ, นามสกุล, สาขาวิชา */
type StudentLite = {
  id: string;
  firstName: string;
  lastName: string;
  major: string;
};

const LS_KEY = "coop.mentor.students";

/* ---------- Utils ---------- */
function toLite(rec: any): StudentLite {
  return {
    id:
      rec.studentId ||
      rec.id ||
      rec.email ||
      `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    firstName: rec.firstName || "",
    lastName: rec.lastName || "",
    major: rec.major || rec.curriculum || rec.program || "",
  };
}

function loadAllStudents(): StudentLite[] {
  try {
    const raw = JSON.parse(localStorage.getItem("coop.student.profile.v1") || "[]");
    return Array.isArray(raw) ? raw.map(toLite) : [];
  } catch {
    return [];
  }
}

function loadMentorStudents(): StudentLite[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(toLite) : [];
  } catch {
    return [];
  }
}

function saveMentorStudents(list: StudentLite[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

/* ---------- Component ---------- */
export default function M_Students() {
  const [items, setItems] = useState<StudentLite[]>([]);
  const [all, setAll] = useState<StudentLite[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    setAll(loadAllStudents());
    setItems(loadMentorStudents());
  }, []);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return all.filter(
      (s) =>
        [s.id, s.firstName, s.lastName, s.major].join(" ").toLowerCase().includes(t) &&
        !items.some((i) => i.id === s.id)
    );
  }, [q, all, items]);

  function add(s: StudentLite) {
    const next = [s, ...items];
    setItems(next);
    saveMentorStudents(next);
  }

  function remove(id: string) {
    const next = items.filter((s) => s.id !== id);
    setItems(next);
    saveMentorStudents(next);
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* ช่องค้นหา */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>ค้นหานักศึกษาทั้งหมด</h2>
        <div style={{ marginLeft: 18, marginTop: 16 }}>
          <input
            className="input"
            placeholder="ค้นหา รหัส/ชื่อ/สาขาวิชา"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 300 }}
          />
        </div>

        {q && (
          <div style={{ marginTop: 16, marginLeft: 18, overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr style={{ gridAutoFlow: "column" }}>
                  <th>รหัสนักศึกษา</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th>สาขาวิชา</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {matches.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>
                      {s.firstName} {s.lastName}
                    </td>
                    <td>{s.major || "-"}</td>
                    <td>
                      <button className="btn" type="button" onClick={() => add(s)}>
                        เพิ่มนักศึกษา
                      </button>
                    </td>
                  </tr>
                ))}
                {matches.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ color: "#6b7280", textAlign: "center" }}>
                      — ไม่พบ —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        )}
      </section>

      {/* รายชื่อนักศึกษาที่ดูแล */}
      <section className="card">
        <h2 style={{ margin: "8px 18px" }}>นักศึกษาที่ดูแล</h2>
        <p style={{ margin: "8px 18px" }}>หากชื่อบริษัทและพี่เลี้ยงตรงกับนักศึกษา จะดึงข้อมูลนักศึกษาอัตโนมัติ</p>
        <div className="cards-grid-horizontal">
          {items.map((s) => (
            <article key={s.id} className="card student-card">
              <div className="student-info">
                <div className="student-name">
                  {s.firstName} {s.lastName}
                </div>
                <div className="student-id">{s.id}</div>
                {s.major && <div className="student-major">{s.major}</div>}
              </div>

              <div className="student-actions">
                <a
                  className="btn"
                  href={`/mentor/daily?student=${encodeURIComponent(s.id)}`}
                >
                  บันทึกประจำวัน
                </a>
                <button className="btn ghost" type="button" onClick={() => remove(s.id)}>
                  ลบ
                </button>
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <div style={{ color: "#6b7280" }}>— ยังไม่มีนักศึกษาที่ดูแล —</div>
          )}
        </div>
      </section>

      <style>{`
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(240px, 1fr));
          gap: 12px;
        }
        .cards-grid-horizontal {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 8px 50px;
        }
        .student-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .student-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .student-name { font-weight: 800; font-size: 15px; }
        .student-id, .student-major { color: #6b7280; font-size: 13px; }
        .student-actions { display: flex; gap: 8px; align-items: center; }
        .btn, .btn.ghost {
          display: flex; align-items: center; justify-content: center;
          text-align: center; min-width: 120px; padding: 8px 14px; font-weight: 600;
        }
        .btn.ghost {
          background: #fff; color: #0f172a; border: 1px solid rgba(0,0,0,.08);
          border-radius: 10px;
        }
        .btn.ghost:hover {
          background: #f8fafc; border-color: #c7d2fe;
          box-shadow: 0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14);
        }
        .tbl{ width:100%; border-collapse:separate; border-spacing:0 8px }
          th{ text-align:left; font-size:13px; color:#6b7280; font-weight:700; padding:4px }
          td{ background:#fff; border:1px solid #e5e7eb; padding:8px; vertical-align:top }
          td:first-child{ border-radius:12px 0 0 12px }
          td:last-child{ border-radius:0 12px 12px 0 }
      `}</style>
    </div>
  );
}
