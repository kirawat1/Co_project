import { useMemo } from "react";
import { Link } from "react-router-dom";
import { loadStudents, loadAcademicYear } from "./store";

const IOS_BLUE = "#0074B7";

/* ===============================
   Teacher helpers
=============================== */

const MAP_KEY_OLD = "coop.admin.teacherStudentsByYear.v1";
const MAP_KEY_NEW = "coop.admin.teacherStudentsByYear";

type TeacherStudentsMap = Record<string, Record<string, string[]>>;

function getTeacherId(): string {
  const raw = localStorage.getItem("coop.teacher.id");
  if (raw) return raw;

  try {
    const p = JSON.parse(localStorage.getItem("coop.teacher.profile") || "{}");
    if (p?.email) return `teacher:${String(p.email).toLowerCase()}`;
  } catch {
    /* ignore */
  }
  return "teacher:unknown";
}

function loadTeacherMap(): TeacherStudentsMap {
  const tryLoad = (key: string): TeacherStudentsMap | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? (obj as TeacherStudentsMap) : null;
    } catch {
      /* ignore */
      return null;
    }
  };
  return tryLoad(MAP_KEY_OLD) || tryLoad(MAP_KEY_NEW) || {};
}

function assignedStudentIds(year: string, teacherId: string): string[] {
  const map = loadTeacherMap();
  const byYear = map[year] || {};
  const list = byYear[teacherId] || [];
  return Array.isArray(list) ? list : [];
}

/* ===============================
   UI helpers
=============================== */

function chip(status?: string) {
  const s = status || "draft";
  const cls =
    s === "submitted"
      ? "under"
      : s === "approved"
      ? "appr"
      : s === "rejected"
      ? "rej"
      : "waiting";

  const label =
    s === "submitted"
      ? "รอพิจารณา"
      : s === "approved"
      ? "ผ่าน"
      : s === "rejected"
      ? "ไม่ผ่าน"
      : "ฉบับร่าง";

  return <span className={`chip ${cls}`}>{label}</span>;
}

/* ===============================
   Component
=============================== */

export default function T_Dashboard() {
  const year = loadAcademicYear();
  const teacherId = getTeacherId();

  const students = loadStudents();
  const myIds = assignedStudentIds(year, teacherId);

  const myIdKey = useMemo(() => myIds.join("|"), [myIds]);

  const myStudents = useMemo(() => {
    const set = new Set(myIds);
    return students.filter((s) => set.has(s.studentId));
  }, [students, myIdKey]);

  const pendingRequests = useMemo(() => {
    return students.filter((s) => s.coopRequest?.status === "submitted");
  }, [students]);

  const myPendingDaily = useMemo(() => {
    let count = 0;

    for (const s of myStudents) {
      try {
        const raw = localStorage.getItem(`coop.daily.${s.studentId}`);
        const list = raw ? (JSON.parse(raw) as unknown[]) : [];

        if (Array.isArray(list)) {
          count += list.filter(
            (x): x is { status: string } =>
              typeof x === "object" &&
              x !== null &&
              "status" in x &&
              (x as { status: string }).status === "submitted"
          ).length;
        }
      } catch {
        /* ignore */
      }
    }

    return count;
  }, [myStudents]);

  return (
    <div style={{ display: "grid", gap: 16, marginLeft: 35, marginTop: 28 }}>
      {/* Header */}
      <section className="card">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>
              ภาพรวมอาจารย์
            </div>
            <div style={{ color: "#6b7280", marginTop: 4 }}>
              ปีการศึกษา: <b>{year}</b>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <CardStat
          title="นักศึกษาที่ดูแล"
          value={myStudents.length}
          hint="อิงตามการจัดสรรจากแอดมิน"
        />
        <CardStat
          title="คำร้องรอพิจารณา"
          value={pendingRequests.length}
          hint="นักศึกษาทั้งระบบ (ยังไม่ตัดสิน)"
        />
        <CardStat
          title="Daily (submitted)"
          value={myPendingDaily}
          hint="เฉพาะนักศึกษาที่ดูแล"
        />
      </section>

      {/* Latest requests */}
      <section className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 900 }}>คำร้องล่าสุด</div>
          <Link
            to="/teacher/requests"
            style={{
              color: IOS_BLUE,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            ดูทั้งหมด →
          </Link>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0 10px",
            }}
          >
            <thead>
              <tr>
                {["รหัส", "ชื่อ-นามสกุล", "บริษัท", "สถานะ"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      fontSize: 13,
                      color: "#374151",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students
                .filter((s) => s.coopRequest?.status)
                .slice(0, 5)
                .map((s) => (
                  <tr
                    key={s.studentId}
                    style={{
                      background: "#fff",
                      border: "1px solid rgba(0,0,0,.06)",
                    }}
                  >
                    <td style={td()}>{s.studentId}</td>
                    <td style={td()}>
                      {`${s.firstName || ""} ${s.lastName || ""}`.trim() ||
                        "-"}
                    </td>
                    <td style={td()}>{s.company?.name || "-"}</td>
                    <td style={td()}>{chip(s.coopRequest?.status)}</td>
                  </tr>
                ))}

              {students.filter((s) => s.coopRequest?.status).length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 12, color: "#6b7280" }}>
                    — ยังไม่มีข้อมูลคำร้อง —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        @media (max-width: 1100px){
          section[style*="grid-template-columns: repeat(3"]{
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ===============================
   Sub components
=============================== */

function CardStat({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ color: "#6b7280", fontWeight: 800, fontSize: 13 }}>
        {title}
      </div>
      <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900 }}>
        {value}
      </div>
      <div style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
        {hint}
      </div>
    </div>
  );
}

function td(): React.CSSProperties {
  return {
    padding: "12px 10px",
    borderTop: "1px solid rgba(0,0,0,.04)",
    borderBottom: "1px solid rgba(0,0,0,.04)",
  };
}
