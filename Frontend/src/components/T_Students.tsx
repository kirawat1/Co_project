import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { StudentProfile } from "./store";
import { loadStudents, loadAcademicYear } from "./store";

const MAP_KEY_OLD = "coop.admin.teacherStudentsByYear.v1";
const MAP_KEY_NEW = "coop.admin.teacherStudentsByYear";

type TeacherStudentsMap = Record<string, Record<string, string[]>>;

function getTeacherId(): string {
  const raw = localStorage.getItem("coop.teacher.id");
  if (raw) return raw;
  try {
    const p = JSON.parse(localStorage.getItem("coop.teacher.profile") || "{}");
    if (p?.email) return `teacher:${String(p.email).toLowerCase()}`;
  } catch { /* empty */ }
  return "teacher:unknown";
}

function loadTeacherMap(): TeacherStudentsMap {
  const tryLoad = (k: string) => {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? (obj as TeacherStudentsMap) : null;
    } catch {
      return null;
    }
  };
  return tryLoad(MAP_KEY_OLD) || tryLoad(MAP_KEY_NEW) || {};
}

function assignedIds(year: string, teacherId: string) {
  const map = loadTeacherMap();
  const byYear = map[year] || {};
  const list = byYear[teacherId] || [];
  return Array.isArray(list) ? list : [];
}

export default function T_Students() {
  const year = loadAcademicYear();
  const teacherId = getTeacherId();

  const [students] = useState<StudentProfile[]>(() => loadStudents());
  const [q, setQ] = useState("");

  const ids = assignedIds(year, teacherId);

  const myStudents = useMemo(() => {
    const set = new Set(ids);
    return students
      .filter((s) => set.has(s.studentId))
      .filter((s) => {
        const t = `${s.studentId} ${s.firstName || ""} ${s.lastName || ""} ${s.company?.name || ""}`.toLowerCase();
        return t.includes(q.toLowerCase());
      });
  }, [ids, students, q]);

  return (
    <div style={{ display: "grid", gap: 16, marginLeft: 35, marginTop: 28 }}>
      <section className="card">
        <div style={{ fontWeight: 1000, fontSize: 20 }}>นักศึกษาที่ดูแล</div>
        <div style={{ color: "#6b7280", marginTop: 4 }}>อิงการจัดสรรของแอดมินในปีการศึกษา <b>{year}</b></div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="ค้นหา: รหัส / ชื่อ / บริษัท"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: "1 1 320px" }}
          />
          <div style={{ display: "inline-flex", alignItems: "center", color: "#6b7280", fontWeight: 800 }}>
            ทั้งหมด {myStudents.length} คน
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", padding: 14 }}>
            <thead>
              <tr>
                {["รหัส", "ชื่อ-นามสกุล", "สาขา", "บริษัท", "คำร้อง", "เปิดดู"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 13, color: "#374151" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myStudents.map((s) => {
                const name = `${s.firstName || ""} ${s.lastName || ""}`.trim() || "-";
                const st = s.coopRequest?.status || "draft";
                return (
                  <tr key={s.studentId} style={{ background: "#fff" }}>
                    <td style={td()}>{s.studentId}</td>
                    <td style={td()}>{name}</td>
                    <td style={td()}>{s.major || "-"}</td>
                    <td style={td()}>{s.company?.name || "-"}</td>
                    <td style={td()}>{chip(st)}</td>
                    <td style={td()}>
                      <Link className="btn" to={`/teacher/students/${s.studentId}`} style={{ textDecoration: "none" }}>
                        รายละเอียด
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {myStudents.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 14, color: "#6b7280" }}>— ไม่มีรายชื่อที่จัดสรรให้คุณในปีนี้ —</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function chip(status: string) {
  const cls =
    status === "submitted" ? "under" :
    status === "approved" ? "appr" :
    status === "rejected" ? "rej" : "waiting";
  const label =
    status === "submitted" ? "รอพิจารณา" :
    status === "approved" ? "ผ่าน" :
    status === "rejected" ? "ไม่ผ่าน" : "ฉบับร่าง";
  return <span className={`chip ${cls}`}>{label}</span>;
}

function td(): React.CSSProperties {
  return { padding: "12px 10px", borderTop: "1px solid rgba(0,0,0,.04)", borderBottom: "1px solid rgba(0,0,0,.04)" };
}