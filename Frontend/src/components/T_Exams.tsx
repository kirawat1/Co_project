import { useEffect, useMemo, useState } from "react";
import type { StudentProfile } from "./store";

const K_EXAMS = "coop.teacher.exams.v1";
const K_STUDENTS_NEW = "coop.students";
const K_STUDENTS_OLD = "coop.student.profile.v1";

type ExamMode = "online" | "onsite";

type ExamItem = {
  id: string;
  teacherId: string;
  studentId: string;
  round?: string;
  date: string;
  time?: string;

  mode: ExamMode; // 👈 เพิ่ม
  location?: string; // ใช้เมื่อ onsite
  onlineUrl?: string; // ใช้เมื่อ online

  note?: string;
  createdAt: string;
  updatedAt?: string;
};
type ExamRow = ExamItem & {
  _name: string;
};

/* ---------------- utils ---------------- */

function jsonLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function jsonSave<T>(key: string, val: T): void {
  localStorage.setItem(key, JSON.stringify(val));
}

function loadStudents(): StudentProfile[] {
  const a = jsonLoad<StudentProfile[]>(K_STUDENTS_NEW, []);
  if (a.length) return a;
  return jsonLoad<StudentProfile[]>(K_STUDENTS_OLD, []);
}

function getTeacherId(): string {
  const id = localStorage.getItem("coop.teacher.id");
  if (id && id.trim()) return id.trim();
  try {
    const p = JSON.parse(localStorage.getItem("coop.teacher.profile") || "{}");
    if (p?.email) return `teacher:${String(p.email).toLowerCase()}`;
  } catch {
    /* empty */
  }
  return "teacher:unknown";
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/* ---------------- component ---------------- */

export default function T_Exams() {
  const teacherId = getTeacherId();

  const [students] = useState<StudentProfile[]>(() => loadStudents());
  const [items, setItems] = useState<ExamItem[]>(() =>
    jsonLoad<ExamItem[]>(K_EXAMS, []).filter((x) => x.teacherId === teacherId)
  );
  const [q, setQ] = useState("");

  useEffect(() => {
    const all = jsonLoad<ExamItem[]>(K_EXAMS, []);
    setItems(all.filter((x) => x.teacherId === teacherId));
  }, [teacherId]);

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ExamItem | null>(null);

  const rows = useMemo<ExamRow[]>(() => {
    const k = q.trim().toLowerCase();

    const withName: ExamRow[] = items.map((x) => {
      const st = students.find((s) => s.studentId === x.studentId);
      const name = st
        ? `${st.firstName || ""} ${st.lastName || ""}`.trim()
        : "-";

      return { ...x, _name: name };
    });

    const base = withName.sort((a, b) =>
      `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`)
    );

    if (!k) return base;

    return base.filter((x) => {
      const t = `${x.studentId} ${x._name} ${x.round || ""} ${
        x.location || ""
      }`.toLowerCase();
      return t.includes(k);
    });
  }, [items, q, students]);

  function openCreate() {
    setEdit({
      id: uid(),
      teacherId,
      studentId: "",
      round: "1",
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",

      mode: "onsite", // 👈 ค่าเริ่มต้น
      location: "",
      onlineUrl: "",

      note: "",
      createdAt: new Date().toISOString(),
    });
    setOpen(true);
  }

  function openEdit(row: ExamItem) {
    setEdit({ ...row });
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setEdit(null);
  }

  function persist(nextMine: ExamItem[]) {
    const all = jsonLoad<ExamItem[]>(K_EXAMS, []);
    const keepOthers = all.filter((x) => x.teacherId !== teacherId);
    jsonSave(K_EXAMS, [...keepOthers, ...nextMine]);
    setItems(nextMine);
  }

  function save() {
    if (!edit) return;
    if (!edit.studentId) return alert("กรุณาเลือกนักศึกษา");
    if (!edit.date) return alert("กรุณาเลือกวันที่");

    if (edit.mode === "onsite" && !edit.location) {
      return alert("กรุณาระบุสถานที่สอบ (ออนไซต์)");
    }

    if (edit.mode === "online" && !edit.onlineUrl) {
      return alert("กรุณาระบุลิงก์สอบออนไลน์");
    }

    const next = [...items];
    const idx = next.findIndex((x) => x.id === edit.id);
    const obj: ExamItem = { ...edit, updatedAt: new Date().toISOString() };

    if (idx >= 0) next[idx] = obj;
    else next.push(obj);

    persist(next);
    close();
  }

  function remove(id: string) {
    if (!confirm("ลบนัดนิเทศรายการนี้?")) return;
    persist(items.filter((x) => x.id !== id));
  }

  return (
    <div className="page" style={{ padding: 4, marginLeft: 35, marginTop: 28 }}>
      {/* -------- Header -------- */}
      <section className="card" style={{ padding: 24, marginBottom: 18 }}>
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
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              นัดสอบนิเทศ
            </h2>
            <div style={{ marginTop: 6, color: "#6b7280", fontWeight: 700 }}>
              รวม {items.length} รายการ
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="ค้นหา: รหัสนักศึกษา / ชื่อ / สถานที่"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 340, maxWidth: "100%" }}
            />
            <button className="btn" onClick={openCreate}>
              + นัดสอบ
            </button>
          </div>
        </div>
      </section>

      {/* -------- Table -------- */}
      <section className="card" style={{ padding: 20, overflowX: "auto" }}>
        <table className="tbl" style={{ width: "100%", minWidth: 920 }}>
          <thead>
            <tr>
              <th>วันที่ / เวลา</th>
              <th>รหัสนักศึกษา</th>
              <th>ชื่อ-นามสกุล</th>
              <th>รอบ</th>
              <th>สถานที่</th>
              <th>หมายเหตุ</th>
              <th style={{ textAlign: "right" }}>การทำงาน</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{x.date}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {x.time || "-"}
                  </div>
                </td>
                <td>{x.studentId}</td>
                <td className="cell-ellipsis">{x._name}</td>
                <td>{x.round || "-"}</td>
                <td className="cell-ellipsis">
                  {x.mode === "online" ? (
                    <a href={x.onlineUrl} target="_blank" rel="noreferrer">
                      ออนไลน์
                    </a>
                  ) : (
                    x.location || "-"
                  )}
                </td>
                <td className="cell-ellipsis">{x.note || "-"}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    className="btn small ghost"
                    onClick={() => openEdit(x)}
                  >
                    แก้ไข
                  </button>{" "}
                  <button
                    className="btn small danger"
                    onClick={() => remove(x.id)}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "#6b7280" }}>
                  — ยังไม่มีรายการ —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* -------- Modal -------- */}
      {open && edit && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                {items.some((x) => x.id === edit.id)
                  ? "แก้ไขนัดสอบนิเทศ"
                  : "สร้างนัดสอบนิเทศ"}
              </div>
            </div>

            <div className="divider" />

            <div className="exam-form">
              <div>
                <label className="label">นักศึกษา</label>
                <select
                  className="input"
                  value={edit.studentId}
                  onChange={(e) =>
                    setEdit({ ...edit, studentId: e.target.value })
                  }
                  style={{ width: "100%" }}
                >
                  <option value="">— เลือกนักศึกษา —</option>
                  {students.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.studentId} - {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">รอบสอบ</label>
                <input
                  className="input"
                  value={edit.round || ""}
                  onChange={(e) => setEdit({ ...edit, round: e.target.value })}
                  style={{ width: "94%" }}
                />
              </div>

              <div>
                <label className="label">วันที่</label>
                <input
                  className="input"
                  type="date"
                  value={edit.date}
                  onChange={(e) => setEdit({ ...edit, date: e.target.value })}
                  style={{ width: "94%" }}
                />
              </div>

              <div>
                <label className="label">เวลา</label>
                <input
                  className="input"
                  type="time"
                  value={edit.time || ""}
                  onChange={(e) => setEdit({ ...edit, time: e.target.value })}
                  style={{ width: "94%" }}
                />
              </div>

              <div>
                <label className="label">รูปแบบการนัดสอบ</label>
                <select
                  className="input"
                  value={edit.mode}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      mode: e.target.value as "online" | "onsite",
                      location: "",
                      onlineUrl: "",
                    })
                  }
                >
                  <option value="onsite">ออนไซต์ (On-site)</option>
                  <option value="online">ออนไลน์ (Online)</option>
                </select>
              </div>

              {edit.mode === "onsite" && (
                <div className="full">
                  <label className="label">สถานที่สอบ On-site</label>
                  <input
                    className="input"
                    value={edit.location || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, location: e.target.value })
                    }
                    placeholder="เช่น บริษัท / ห้องประชุม"
                    style={{ width: "97%" }}
                  />
                </div>
              )}

              {edit.mode === "online" && (
                <div className="full">
                  <label className="label">ลิงก์สอบ Online</label>
                  <input
                    className="input"
                    value={edit.onlineUrl || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, onlineUrl: e.target.value })
                    }
                    placeholder="เช่น https://meet.google.com/xxx"
                    style={{ width: "97%" }}
                  />
                </div>
              )}

              <div className="full">
                <label className="label">หมายเหตุ</label>
                <textarea
                  className="input"
                  rows={3}
                  value={edit.note || ""}
                  onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                  style={{ width: "97%" }}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn ghost" onClick={close}>
                ยกเลิก
              </button>
              <button className="btn" onClick={save}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------- Styles -------- */}
      <style>{`
        .modal-backdrop{
          position:fixed; inset:0;
          background:rgba(15,23,42,.55);
          display:flex; align-items:center; justify-content:center;
          padding:18px; z-index:50;
        }
        .modal{
          width:min(860px,100%);
          max-height:92vh;
          overflow:auto;
          background:#fff;
          border-radius:20px;
          padding:24px;
          box-shadow:0 24px 70px rgba(15,23,42,.28);
        }
        .modal-header{
          display:flex; justify-content:space-between; align-items:center;
        }
        .modal-title{ font-size:20px; font-weight:800 }
        .divider{ height:1px; background:rgba(0,0,0,.06); margin:16px 0 22px }

        .exam-form{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:18px 24px;
        }
        .exam-form .full{ grid-column:1/-1 }

        .label{ font-size:13px; font-weight:600; color:#374151 }
        .input{
          height:46px; border-radius:12px;
          border:1px solid #e5e7eb;
          padding:0 14px; font-size:15px;
        }
        textarea.input{ padding:10px 14px }
        .input:focus{
          border-color:#0074B7;
          box-shadow:0 0 0 4px rgba(0,116,183,.15);
        }

        .modal-actions{
          display:flex; justify-content:flex-end;
          gap:10px; margin-top:28px;
        }

        .cell-ellipsis{
          max-width:26ch; overflow:hidden;
          text-overflow:ellipsis; white-space:nowrap;
        }

        .btn.small{ font-size:12px; padding:7px 10px }
        .btn.small.danger{
          background:#fff; color:#b91c1c;
          border:1px solid rgba(185,28,28,.25);
        }
        .btn.small.danger:hover{
          background:#fef2f2; border-color:#fca5a5;
        }

        @media(max-width:1024px){
          .page{ margin:14px !important }
          table{ min-width:920px }
        }
      `}</style>
    </div>
  );
}
