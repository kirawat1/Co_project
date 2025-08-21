// src/components/M_Students.tsx
import React, { useEffect, useMemo, useState } from "react";

/** ใช้แสดงเฉพาะ: ชื่อ, นามสกุล, สาขาวิชา */
type StudentLite = {
  id: string;
  firstName: string;
  lastName: string;
  major: string;
};

const LS_MANUAL = "coop.mentor.students";

/* ---------- Utils ---------- */
const norm = (s?: string) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

function toLite(rec: any): StudentLite {
  return {
    id: rec.studentId || rec.id || rec.email || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    firstName: rec.firstName || "",
    lastName: rec.lastName || "",
    major: rec.major || rec.curriculum || rec.program || "",
  };
}


/** อ่าน array นักศึกษาจาก localStorage (ลองหลาย key เผื่อระบบเดิมเก็บไม่เหมือนกัน) */
/** อ่าน array นักศึกษาจาก localStorage (ลองหลาย key เผื่อระบบเดิมเก็บไม่เหมือนกัน) */
function readAnyStudentsArrayFromLocalStorage(): any[] {
  const candidates = [
    "coop.student.profile.v1",
    "coop.students.all",
    "coop.students",
    "coop.student.list",
    "coop.student.registry",
    "students",
  ];

  for (const k of candidates) {
    try {
      const raw = JSON.parse(localStorage.getItem(k) || "null");

      // ✅ ถ้าเป็น array ตรงๆ
      if (Array.isArray(raw)) return raw;

      // ✅ ถ้าเป็น object เดี่ยว มี studentId
      if (raw && typeof raw === "object" && raw.studentId) {
        return [raw];
      }
    } catch { }
  }

  // ✅ สำรอง: scan ทุก key ใน localStorage
  const bag: any[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    try {
      const raw = JSON.parse(localStorage.getItem(k) || "null");
      if (
        Array.isArray(raw) &&
        raw.some((o) => o && typeof o === "object" && ("firstName" in o || "lastName" in o))
      ) {
        bag.push(...raw);
      }
      // ✅ ถ้าเจอ object เดี่ยวก็แปลงให้เป็น array
      else if (raw && typeof raw === "object" && raw.studentId) {
        bag.push(raw);
      }
    } catch { }
  }
  return bag;
}


/** ดึงนักศึกษาที่ผูกกับชื่อพี่เลี้ยงปัจจุบัน */
function loadStudentsByMentorAndCompany(currentMentorName: string, currentCompanyName: string): StudentLite[] {
  if (!currentMentorName || !currentCompanyName) return [];
  const mentorTarget = norm(currentMentorName);
  const companyTarget = norm(currentCompanyName);

  try {
    const raw = JSON.parse(localStorage.getItem("coop.student.profile.v1") || "[]");
    if (!Array.isArray(raw)) return [];

    const picked = raw.filter((r) => {
      // --- check company ---
      const companyOk = r.company?.name && norm(r.company.name) === companyTarget;
      if (!companyOk) return false;

      // --- check mentor ---
      const single = r.mentorName || r.mentor || r.companyMentor || r.coopMentor;
      const list = r.mentors || r.mentorList || r.coopMentors || (Array.isArray(single) ? single : null);

      if (list && Array.isArray(list)) {
        return list.map(norm).includes(mentorTarget);
      }
      if (single && typeof single === "object") {
        const full = `${single.firstName || ""} ${single.lastName || ""}`.trim().toLowerCase();
        return norm(full) === mentorTarget;
      }
      return norm(single) === mentorTarget;
    });

    const map = new Map<string, StudentLite>();
    picked.forEach((r) => {
      const lite = toLite(r);
      if (lite.id && !map.has(lite.id)) map.set(lite.id, lite);
    });
    return [...map.values()];
  } catch {
    return [];
  }
}

/** manual list ที่พี่เลี้ยงเพิ่มเอง */
function loadManual(): StudentLite[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_MANUAL) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(toLite).filter((s) => s.firstName || s.lastName || s.major);
  } catch {
    return [];
  }
}
function saveManual(list: StudentLite[]) {
  localStorage.setItem(LS_MANUAL, JSON.stringify(list));
}

/* ---------- Component ---------- */
export default function M_Students() {
  const [items, setItems] = useState<StudentLite[]>([]);
  const [source, setSource] = useState<"registry" | "manual">("manual"); // registry = ดึงจากฝั่งนักศึกษา
  const [q, setQ] = useState("");

  const [all, setAll] = useState<StudentLite[]>([]);
  const [searchId, setSearchId] = useState("");
  // ฟอร์มเพิ่มเอง (ใช้เมื่อไม่มีข้อมูลจาก registry)
  const [draft, setDraft] = useState<StudentLite>({
    id: "",
    firstName: "",
    lastName: "",
    major: "",
  });
  function up<K extends keyof StudentLite>(k: K, v: StudentLite[K]) {
    setDraft({ ...draft, [k]: v });
  }
  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.major.trim()) return;
    const id =
      (globalThis as any)?.crypto?.randomUUID?.() ??
      `id_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const next = [{ ...draft, id }, ...items];
    setItems(next);
    saveManual(next);
    setDraft({ id: "", firstName: "", lastName: "", major: "" });
  }
  function remove(id: string) {
    const next = items.filter((s) => s.id !== id);
    setItems(next);
    if (source === "manual") saveManual(next);
  }

  function addExisting(s: StudentLite) {
    if (items.some((i) => i.id === s.id)) return;
    const next = [s, ...items];
    setItems(next);
    if (source === "manual") saveManual(next);
  }
  // โหลดรายการอัตโนมัติตามชื่อพี่เลี้ยง
  useEffect(() => {
    const data = readAnyStudentsArrayFromLocalStorage().map(toLite);
    console.log("All students in localStorage:", data);
    setAll(data);
    const mentorProfile = (() => {
      try {
        return JSON.parse(localStorage.getItem("coop.mentor.profile") || "{}");
      } catch {
        return {};
      }


    })();

    const mentorName = `${mentorProfile.firstName || ""} ${mentorProfile.lastName || ""}`.trim();
    const companyName = mentorProfile.companyName || "";

    const fromRegistry = loadStudentsByMentorAndCompany(mentorName, companyName);
    if (fromRegistry.length) {
      setItems(fromRegistry);
      setSource("registry");
    } else {
      setItems(loadManual());
      setSource("manual");
    }
  }, []);



  useEffect(() => {
    setAll(readAnyStudentsArrayFromLocalStorage().map(toLite));
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((s) =>
      [s.id, s.firstName, s.lastName, s.major]
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
  }, [q, items]);

  const matches = useMemo(() => {
    const t = searchId.trim().toLowerCase();
    if (!t) return [] as StudentLite[];
    return all.filter(
      (s) => s.id.toLowerCase().includes(t) && !items.some((i) => i.id === s.id)
    );
  }, [searchId, all, items]);

  const showAddForm = source === "manual";

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* ฟอร์มเพิ่มนักศึกษา — 3 ช่องกว้างเท่ากัน + ปุ่มต่อท้าย (แสดงเฉพาะตอนใช้ manual) */}
      {showAddForm && (
        <section className="card" style={{ padding: 24, marginBottom: 28 }}>
          <h2 style={{ marginTop: 8, marginLeft: 18 }}>ค้นหานักศึกษาที่ดูแล</h2>
          <div style={{ marginLeft: 18, marginTop: 16 }}>
            <input
              className="input"
              placeholder="ค้นหารหัสด้วยนักศึกษา"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              style={{ maxWidth: 300 }}
            />
          </div>
          {matches.length > 0 && (
            <div className="cards-grid" style={{ marginTop: 16, marginLeft: 18 }}>
              {matches.map((s) => (
                <article key={s.id} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 800 }}>
                    {s.firstName} {s.lastName}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                    {s.id}
                  </div>
                  {s.major && (
                    <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                      {s.major}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="btn" type="button" onClick={() => addExisting(s)}>
                      เพิ่มนักศึกษา
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {searchId.trim() && matches.length === 0 && (
            <div style={{ color: "#6b7280", marginTop: 8, marginLeft: 18 }}>— ไม่พบ —</div>
          )}
          <h2 style={{ marginTop: 18, marginLeft: 18 }}>เพิ่มนักศึกษาที่ดูแล</h2>
          {/* จัดคอลัมน์ 300px/ช่อง + ปุ่มในคอลัมน์ที่ 4 และเว้นช่องห่างกว้างขึ้น */}
          <form
            onSubmit={add}
            className="add-form"
            style={{ gridTemplateColumns: "300px 300px 300px auto", columnGap: 80, rowGap: 16 }}
          >
            <div className="field">
              <label className="label">ชื่อ</label>
              <input
                className="input"
                value={draft.firstName}
                onChange={(e) => up("firstName", e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>

            <div className="field">
              <label className="label">นามสกุล</label>
              <input
                className="input"
                value={draft.lastName}
                onChange={(e) => up("lastName", e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>

            <div className="field">
              <label className="label">สาขาวิชา</label>
              <input
                className="input"
                value={draft.major}
                onChange={(e) => up("major", e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>

            {/* ปุ่มต่อท้ายสาขาวิชา ในคอลัมน์ที่ 4 */}
            <div className="actions" style={{ gridColumn: "4 / 5", alignSelf: "end", marginTop: 0 }}>
              <button className="btn" type="submit">เพิ่มนักศึกษา</button>
            </div>
          </form>
        </section>
      )}

      {/* รายชื่อนักศึกษา */}
      <section className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: 10,
          }}
        >
          <h2 style={{ marginTop: 8, marginLeft: 18 }}>
            นักศึกษาที่ดูแล{source === "registry" ? " (อ้างอิงจากฝั่งนักศึกษา)" : ""}
          </h2>
          <input
            className="input"
            placeholder="ค้นหา รหัส/ชื่อ/สาขาวิชา"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 300, marginTop: 8, marginRight: 24 }}
          />
        </div>

        <div className="cards-grid-horizontal">
          {filtered.map((s) => (
            <article key={s.id} className="card student-card">
              {/* ข้อมูลนักศึกษา */}
              <div className="student-info">
                <div className="student-name">
                  {s.firstName} {s.lastName}
                </div>
                <div className="student-id">{s.id}</div>
                {s.major && <div className="student-major">{s.major}</div>}
              </div>

              {/* ปุ่ม */}
              <div className="student-actions">
                <a className="btn" href={`/mentor/daily?student=${encodeURIComponent(s.id)}`}>
                  บันทึกประจำวัน
                </a>
                {source === "manual" && (
                  <button className="btn ghost" type="button" onClick={() => remove(s.id)}>
                    ลบนักศึกษา
                  </button>
                )}
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div style={{ color: "#6b7280" }}>— ไม่มีรายการ —</div>
          )}
        </div>
      </section>

      {/* CSS เดิมที่คุณตั้งค่าไว้ */}
      <style>{`
        .add-form{
          display:grid;
          justify-content: start;
          margin-left: 90px;
          margin-top: 10px;
          align-items: end;
          max-width: 100%;
          margin-bottom: 10px;
        }
        .field{ display:flex; flex-direction:column; gap: 8px; }
        .actions{ grid-column: 1 / -1; }

        .field > .input{
          width: 100%;
        }

        .cards-grid{
          display:grid;
          grid-template-columns: repeat(3, minmax(240px,1fr));
          gap:12px;
        }

        @media (max-width: 1024px){
          .add-form{ grid-template-columns: 1fr !important; }
          .actions{ grid-column: 1; }
          .cards-grid{ grid-template-columns: 1fr; }
        }

        .btn.ghost{
          background:#fff; color:#0f172a; border:1px solid rgba(0,0,0,.08);
          border-radius:10px; padding:10px 14px; font-weight:700
        }
        .btn.ghost:hover{
          background:#f8fafc; border-color:#c7d2fe;
          box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14)
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

          .student-name {
            font-weight: 800;
            font-size: 15px;
          }

          .student-id,
          .student-major {
            color: #6b7280;
            font-size: 13px;
          }

          .student-actions {
            display: flex;
            gap: 8px;
            align-items: center;
          }

          .btn, .btn.ghost {
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            min-width: 120px;
            padding: 8px 14px;
            font-weight: 600;
          }

        
      `}</style>
    </div>
  );
}
