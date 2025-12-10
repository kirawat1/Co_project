// src/components/A_Teacher.tsx

import React, { useEffect, useMemo, useState } from "react";

const LS_TEACHERS = "coop.admin.teachers.v1";
const LS_TEACHER_STUDENTS = "coop.admin.teacherStudentsByYear.v1";
const LS_STUDENTS = "coop.student.profile.v1";
const LS_YEAR = "coop.admin.academicYear";

type Teacher = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
};

type TeacherStudentsMap = Record<string, Record<string, string[]>>;

type StudentLite = {
  studentId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  major?: string;
  curriculum?: string;
};

const YEAR_OPTIONS = [
  "2568/1",
  "2568/2",
  "2567/1",
  "2567/2",
  "2566/1",
  "2566/2",
];

// รายการภาควิชา/หลักสูตร ให้เลือกจาก select
const DEPT_OPTIONS = [
  "วิทยาการคอมพิวเตอร์",
  "วิศวกรรมซอฟต์แวร์",
  "เทคโนโลยีสารสนเทศ",
  "วิทยาการข้อมูล",
  "หลักสูตรอื่นในคณะ",
];

function loadYear(): string {
  return localStorage.getItem(LS_YEAR) || "2568/1";
}

function loadTeachers(): Teacher[] {
  try {
    return JSON.parse(localStorage.getItem(LS_TEACHERS) || "[]") || [];
  } catch {
    return [];
  }
}

function saveTeachers(list: Teacher[]) {
  localStorage.setItem(LS_TEACHERS, JSON.stringify(list));
}

function loadTeacherStudents(): TeacherStudentsMap {
  try {
    return JSON.parse(localStorage.getItem(LS_TEACHER_STUDENTS) || "{}") || {};
  } catch {
    return {};
  }
}

function saveTeacherStudents(map: TeacherStudentsMap) {
  localStorage.setItem(LS_TEACHER_STUDENTS, JSON.stringify(map));
}

function loadStudents(): StudentLite[] {
  try {
    return JSON.parse(localStorage.getItem(LS_STUDENTS) || "[]") || [];
  } catch {
    return [];
  }
}

/* ---------- ฟอร์มอาจารย์ ---------- */
type TeacherFormState = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  department: string;
};

export default function A_Teachers() {
  // ปีการศึกษา (ใช้ key เดียวกับหน้า Settings)
  const [year, setYear] = useState<string>(() => loadYear());
  useEffect(() => {
    localStorage.setItem(LS_YEAR, year);
  }, [year]);

  const yearOptions = useMemo(
    () =>
      YEAR_OPTIONS.includes(year) ? YEAR_OPTIONS : [...YEAR_OPTIONS, year],
    [year]
  );

  // ข้อมูลหลัก
  const [teachers, setTeachers] = useState<Teacher[]>(() => loadTeachers());
  const [map, setMap] = useState<TeacherStudentsMap>(() =>
    loadTeacherStudents()
  );
  const [students] = useState<StudentLite[]>(() => loadStudents());

  // UI states
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TeacherFormState>({
    name: "",
    email: "",
    phone: "",
    department: "",
  });

  const [assignTarget, setAssignTarget] = useState<Teacher | null>(null);
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [assignFilter, setAssignFilter] = useState("");

  // persist
  useEffect(() => {
    saveTeachers(teachers);
  }, [teachers]);

  useEffect(() => {
    saveTeacherStudents(map);
  }, [map]);

  /* ---------- ค่าที่คำนวณ ---------- */
  const filtered = useMemo(
    () =>
      teachers.filter((t) => {
        const base = `${t.name || ""} ${t.email || ""}`.toLowerCase();
        const dept = (t.department || "").toLowerCase();
        const needle = q.toLowerCase();

        return base.includes(needle) || dept.includes(needle);
      }),
    [teachers, q]
  );

  function countStudentsFor(t: Teacher): number {
    return map[t.id]?.[year]?.length || 0;
  }

  const filteredStudents = useMemo(() => {
    const needle = assignFilter.toLowerCase();
    return students.filter((s) => {
      const base = `${s.studentId || ""} ${s.firstName || ""} ${
        s.lastName || ""
      }`.toLowerCase();
      const extra = `${s.major || ""} ${s.curriculum || ""}`.toLowerCase();

      return base.includes(needle) || extra.includes(needle);
    });
  }, [students, assignFilter]);

  function displayStudentName(s: StudentLite): string {
    const full = `${s.firstName || ""} ${s.lastName || ""}`.trim();
    return `${s.studentId || "-"}  ${full || ""}`.trim();
  }

  /* ---------- จัดการฟอร์มอาจารย์ ---------- */
  function openAdd() {
    setForm({ name: "", email: "", phone: "", department: "" });
    setShowForm(true);
  }

  function openEdit(t: Teacher) {
    setForm({
      id: t.id,
      name: t.name || "",
      email: t.email || "",
      phone: t.phone || "",
      department: t.department || "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
  }

  function saveForm(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      alert("กรุณากรอกชื่ออาจารย์");
      return;
    }
    const email = form.email.trim();
    const phone = form.phone.trim();
    const department = form.department.trim();

    if (form.id) {
      const next = teachers.map((t) =>
        t.id === form.id ? { ...t, name, email, phone, department } : t
      );
      setTeachers(next);
    } else {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const next: Teacher[] = [
        ...teachers,
        { id, name, email, phone, department },
      ];
      setTeachers(next);
    }
    setShowForm(false);
  }

  function removeTeacher(id: string) {
    if (!confirm("ลบข้อมูลอาจารย์ท่านนี้?")) return;
    const next = teachers.filter((t) => t.id !== id);
    setTeachers(next);

    const nextMap = { ...map };
    delete nextMap[id];
    setMap(nextMap);
  }

  /* ---------- กำหนดนักศึกษาที่ดูแล ---------- */
  function openAssign(t: Teacher) {
    const current = map[t.id]?.[year] || [];
    setAssignTarget(t);
    setAssignIds(current);
    setAssignFilter("");
  }

  function toggleAssign(studentId: string) {
    setAssignIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  }

  function saveAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignTarget) return;
    setMap((prev) => {
      const next: TeacherStudentsMap = { ...prev };
      const inner = { ...(next[assignTarget.id] || {}) };
      inner[year] = [...assignIds];
      next[assignTarget.id] = inner;
      return next;
    });
    setAssignTarget(null);
    setAssignIds([]);
  }

  /* ========================= UI ========================= */

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* Header card */}
      <section className="card" style={{ padding: 20, marginBottom: 28 }}>
        <div
          className="teacher-header"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {/* ซ้าย: หัวข้อ + คำอธิบาย */}
          <div style={{ minWidth: 220 }}>
            <h2 style={{ margin: 5 }}>จัดการอาจารย์นิเทศ</h2>
          </div>

          {/* ขวา: ปีการศึกษา + ค้นหา + ปุ่มเพิ่ม */}
          <div
            className="teacher-toolbar"
            style={{
              display: "grid",
              gridTemplateColumns: "auto minmax(220px, 1.5fr) auto",
              gap: 10,
              alignItems: "center",
              marginLeft: "auto",
            }}
          >
            {/* ปีการศึกษา */}
            <div style={{ marginRight: 20 }}>
              <label
                className="label"
                style={{
                  marginBottom: 2,
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                <p
                  style={{
                    marginTop: 0,
                    marginLeft: 10,
                    marginBottom: 8,
                  }}
                >
                  ปีการศึกษา
                </p>
              </label>
              <select
                className="input"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                style={{
                  width: 130,
                  height: 32,
                  padding: "4px 14px",
                  fontSize: 15,
                  fontWeight: 600,
                  borderRadius: 999,
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* ค้นหาอาจารย์ */}
            <div>
              <label
                className="label"
                style={{
                  marginBottom: 4,
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                ค้นหาอาจารย์
              </label>
              <input
                className="input"
                placeholder="ค้นหา: ชื่อ / อีเมล / สาขาวิชา"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ width: "90%", height: 40 }}
              />
            </div>

            {/* ปุ่มเพิ่มอาจารย์ */}
            <div
              style={{
                alignSelf: "end",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={openAdd}
                style={{ whiteSpace: "nowrap", height: 39, }}
              >
                <p
                  style={{
                    fontSize: 16,
                    margin: 0,
                    textAlign: "center",
                  }}
                >
                  + เพิ่มอาจารย์
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* responsive header styles */}
        <style>{`
          @media (max-width:1024px){
            .teacher-header{
              align-items: stretch;
            }
            .teacher-toolbar{
              width: 100%;
              grid-template-columns: 1fr;
            }
            .teacher-toolbar > div{
              width: 100%;
            }
            .teacher-toolbar button{
              width: 100%;
            }
          }
        `}</style>
      </section>

      {/* ตารางอาจารย์ */}
      <section className="card" style={{ padding: 20 }}>
        <table
          className="tbl"
          style={{ width: "100%", borderCollapse: "collapse" }}
        >
          <thead>
            <tr>
              <th style={{ width: "32%", textAlign: "left" }}>อาจารย์นิเทศ</th>
              <th style={{ width: "18%", textAlign: "left" }}>สาขาวิชา</th>
              <th style={{ width: "18%", textAlign: "left" }}>ติดต่อ</th>
              <th style={{ width: "12%", textAlign: "center" }}>
                จำนวนนักศึกษา
              </th>
              <th style={{ width: "20%", textAlign: "left" }}>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ textAlign: "center", padding: 16, color: "#6b7280" }}
                >
                  ยังไม่มีข้อมูลอาจารย์นิเทศ
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id}>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ fontWeight: 600 }}>{t.name || "-"}</div>
                    {t.email && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {t.email}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "10px 8px" }}>{t.department || "-"}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {t.phone && <div style={{ fontSize: 13 }}>{t.phone}</div>}
                    {t.email && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        อีเมล: {t.email}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "10px 8px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 32,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {countStudentsFor(t)}
                    </span>
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => openAssign(t)}
                      >
                        กำหนด นศ. ปีนี้
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => openEdit(t)}
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => removeTeacher(t.id)}
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Modal: Add/Edit Teacher */}
      {showForm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 style={{ marginTop: 0 }}>
              {form.id ? "แก้ไขข้อมูลอาจารย์" : "เพิ่มอาจารย์นิเทศ"}
            </h3>
            <form
              onSubmit={saveForm}
              style={{ display: "grid", gap: 10, marginTop: 8 }}
            >
              <div>
                <label className="label" style={{ marginLeft: 10, }}>ชื่อ-นามสกุล</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                  style={{ width: 490, }}
                />
              </div>
              <div>
                <label className="label" style={{ marginLeft: 10, }}>อีเมล</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="optional"
                  style={{ width: 490, }}
                />
              </div>
              <div>
                <label className="label" style={{ marginLeft: 10, }}>เบอร์โทร</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="optional"
                  style={{ width: 490, }}
                />
              </div>
              <div>
                <label className="label" style={{ marginLeft: 10, }}>ภาควิชา/หลักสูตร</label>
                <select
                  className="input"
                  value={form.department}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, department: e.target.value }))
                  }
                  style={{ height: 40 }}
                >
                  <option value="">— เลือกภาควิชา / หลักสูตร —</option>
                  {DEPT_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeForm}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign students */}
      {assignTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 720 }}>
            <h3 style={{ marginTop: 0 }}>
              กำหนดนักศึกษาที่อยู่ในความดูแล ปีการศึกษา {year}
            </h3>
            <p style={{ marginTop: 0, fontSize: 13, color: "#6b7280" }}>
              อาจารย์: <b>{assignTarget.name}</b>
            </p>

            <form
              onSubmit={saveAssign}
              style={{ display: "grid", gap: 10, maxHeight: "70vh" }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <input
                  className="input"
                  placeholder="ค้นหานักศึกษา: รหัส / ชื่อ / สาขา"
                  value={assignFilter}
                  onChange={(e) => setAssignFilter(e.target.value)}
                  style={{ minWidth: 260 }}
                />
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  เลือกได้หลายคน (ติ๊กถูกหน้าชื่อ)
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 8,
                  maxHeight: "48vh",
                  overflow: "auto",
                }}
              >
                {filteredStudents.length === 0 ? (
                  <div style={{ padding: 8, fontSize: 13 }}>
                    ยังไม่มีรายการนักศึกษาในระบบ
                  </div>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(240px,1fr))",
                      gap: 4,
                    }}
                  >
                    {filteredStudents.map((s) => {
                      const id = s.studentId || "";
                      const checked = assignIds.includes(id);
                      return (
                        <li
                          key={id || Math.random()}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 6px",
                            borderRadius: 8,
                            background: checked ? "#eff6ff" : "transparent",
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              width: "100%",
                              cursor: "pointer",
                              fontSize: 13,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!id}
                              onChange={() => id && toggleAssign(id)}
                            />
                            <span>
                              {displayStudentName(s)}
                              {s.major && (
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: 11,
                                    color: "#6b7280",
                                  }}
                                >
                                  {s.major}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 6,
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  เลือกแล้ว {assignIds.length} คน
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setAssignTarget(null);
                      setAssignIds([]);
                    }}
                  >
                    ปิด
                  </button>
                  <button type="submit" className="btn">
                    บันทึกการกำหนด
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* styles สำหรับ modal + ปุ่มรอง */}
      <style>{`
        .modal-backdrop{
          position:fixed; inset:0;
          background:rgba(15,23,42,.35);
          display:flex; align-items:center; justify-content:center;
          z-index:40;
        }
        .modal-card{
          background:#fff;
          border-radius:18px;
          padding:20px 20px 16px;
          width:100%;
          max-width:520px;
          box-shadow:0 18px 45px rgba(15,23,42,.24);
        }
        .btn-secondary{
          border-radius:999px;
          padding:6px 14px;
          border:1px solid #e5e7eb;
          background:#fff;
          font-size:13px;
          cursor:pointer;
        }
        .btn-danger{
          border-radius:999px;
          padding:6px 14px;
          border:1px solid #fecaca;
          background:#fef2f2;
          color:#b91c1c;
          font-size:13px;
          cursor:pointer;
        }
        @media (max-width:1024px){
          .modal-card{
            margin:0 16px;
          }
        }
      `}</style>
    </div>
  );
}
