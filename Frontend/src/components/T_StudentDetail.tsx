/* eslint-disable react-refresh/only-export-components */
import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { loadStudents } from "./store";

/* =========================
   Types
========================= */
type VisitStatus = "scheduled" | "done";

type Visit = {
  id: string;
  studentId: string;
  date: string;
  time?: string;
  location?: string;
  note?: string;
  status: VisitStatus;
  createdAt: string;
};

type VisitForm = {
  studentId: string;
  date: string;
  time?: string;
  location?: string;
  note?: string;
  status: VisitStatus;
};

/* =========================
   Storage helpers
========================= */
function getTeacherId(): string {
  const raw = localStorage.getItem("coop.teacher.id");
  if (raw) return raw;

  try {
    const p = JSON.parse(
      localStorage.getItem("coop.teacher.profile") || "{}"
    );
    if (p?.email) return `teacher:${String(p.email).toLowerCase()}`;
  } catch {
    /* ignore */
  }
  return "teacher:unknown";
}

function visitsKey(teacherId: string) {
  return `coop.teacher.visits.v1.${teacherId}`;
}

function loadVisits(teacherId: string): Visit[] {
  try {
    const raw = JSON.parse(
      localStorage.getItem(visitsKey(teacherId)) || "[]"
    );

    if (!Array.isArray(raw)) return [];

    return raw.map(
      (v): Visit => ({
        id: String(v.id),
        studentId: String(v.studentId),
        date: String(v.date),
        time: v.time ? String(v.time) : undefined,
        location: v.location ? String(v.location) : undefined,
        note: v.note ? String(v.note) : undefined,
        status: v.status === "done" ? "done" : "scheduled",
        createdAt: String(v.createdAt),
      })
    );
  } catch {
    return [];
  }
}

function saveVisits(teacherId: string, list: Visit[]) {
  localStorage.setItem(visitsKey(teacherId), JSON.stringify(list));
}

/* =========================
   Main Component
========================= */
export default function T_StudentDetail() {
  const { studentId = "" } = useParams();
  const teacherId = getTeacherId();

  const students = loadStudents();
  const student = students.find((s) => s.studentId === studentId) || null;

  const [tab, setTab] = useState<
    "profile" | "company" | "docs" | "visits"
  >("profile");

  const [visits, setVisits] = useState<Visit[]>(() =>
    loadVisits(teacherId)
  );

  const myVisits = useMemo(() => {
    return visits
      .filter((v) => v.studentId === studentId)
      .sort((a, b) =>
        `${b.date} ${b.time || ""}`.localeCompare(
          `${a.date} ${a.time || ""}`
        )
      );
  }, [visits, studentId]);

  const [visitForm, setVisitForm] = useState<VisitForm>({
    studentId,
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    status: "scheduled",
  });

  if (!student) {
    return (
      <div className="card">
        <div style={{ fontWeight: 1000, fontSize: 18 }}>ไม่พบนักศึกษา</div>
        <Link
          to="/teacher/students"
          style={{
            color: "#0074B7",
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          ← กลับไปหน้ารายชื่อ
        </Link>
      </div>
    );
  }

  const fullName =
    `${student.firstName || ""} ${student.lastName || ""}`.trim() || "-";

  /* =========================
     Visit actions
  ========================= */
  function addVisit() {
    if (!visitForm.date) return alert("กรุณาเลือกวันที่");

    const v: Visit = {
      id: cryptoId(),
      studentId: visitForm.studentId,
      date: visitForm.date,
      time: visitForm.time,
      location: visitForm.location,
      note: visitForm.note,
      status: visitForm.status,
      createdAt: new Date().toISOString(),
    };

    const next: Visit[] = [v, ...visits];
    setVisits(next);
    saveVisits(teacherId, next);

    setVisitForm({
      studentId,
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",
      status: "scheduled",
    });
  }

  function toggleDone(id: string) {
    const next: Visit[] = visits.map((v): Visit =>
      v.id === id
        ? {
            ...v,
            status: v.status === "done" ? "scheduled" : "done",
          }
        : v
    );
    setVisits(next);
    saveVisits(teacherId, next);
  }

  function removeVisit(id: string) {
    if (!confirm("ลบนัดนิเทศรายการนี้?")) return;
    const next: Visit[] = visits.filter((v) => v.id !== id);
    setVisits(next);
    saveVisits(teacherId, next);
  }

  /* =========================
     UI
  ========================= */
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>{fullName}</div>
            <div style={{ color: "#6b7280" }}>
              รหัส: <b>{student.studentId}</b> • สาขา:{" "}
              <b>{student.major || "-"}</b> • บริษัท:{" "}
              <b>{student.company?.name || "-"}</b>
            </div>
          </div>
          <Link className="btn" to="/teacher/students">
            ← กลับ
          </Link>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Tab label="ข้อมูลส่วนตัว" active={tab === "profile"} onClick={() => setTab("profile")} />
          <Tab label="ข้อมูลบริษัท" active={tab === "company"} onClick={() => setTab("company")} />
          <Tab label="เอกสาร" active={tab === "docs"} onClick={() => setTab("docs")} />
          <Tab label="นัดนิเทศ" active={tab === "visits"} onClick={() => setTab("visits")} />
        </div>
      </section>

      {/* VISITS */}
      {tab === "visits" && (
        <section className="card">
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>
            นัดนิเทศ / ติดตาม
          </div>

          <button className="btn" onClick={addVisit}>
            เพิ่มนัดนิเทศ
          </button>

          <table style={{ width: "100%", marginTop: 12 }}>
            <tbody>
              {myVisits.map((v) => (
                <tr key={v.id}>
                  <td>
                    {v.date} {v.time}
                  </td>
                  <td>{v.location || "-"}</td>
                  <td>{v.note || "-"}</td>
                  <td>{v.status}</td>
                  <td>
                    <button onClick={() => toggleDone(v.id)}>
                      สลับสถานะ
                    </button>
                    <button onClick={() => removeVisit(v.id)}>ลบ</button>
                  </td>
                </tr>
              ))}
              {myVisits.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "#6b7280" }}>
                    — ยังไม่มีนัดนิเทศ —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/* =========================
   Small components
========================= */
function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn"
      style={{
        background: active ? "#0074B7" : "#fff",
        color: active ? "#fff" : "#0f172a",
      }}
    >
      {label}
    </button>
  );
}

function cryptoId() {
  if ("crypto" in globalThis && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `v_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
