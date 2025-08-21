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
  const id =
    rec.id ||
    rec.studentId ||
    rec.email ||
    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    firstName: rec.firstName || "",
    lastName: rec.lastName || "",
    major: rec.major || rec.curriculum || rec.program || "",
  };
}

/** อ่าน array นักศึกษาจาก localStorage (ลองหลาย key เผื่อระบบเดิมเก็บไม่เหมือนกัน) */
function readAnyStudentsArrayFromLocalStorage(): any[] {
  const candidates = [
    "coop.students.all",
    "coop.students",
    "coop.student.list",
    "coop.student.registry",
    "students",
  ];
  for (const k of candidates) {
    try {
      const raw = JSON.parse(localStorage.getItem(k) || "null");
      if (Array.isArray(raw)) return raw;
    } catch {}
  }
  // สำรอง: scan ทุก key หา array ของ object ที่คล้ายโปรไฟล์นักศึกษา
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
    } catch {}
  }
  return bag;
}

/** ดึงนักศึกษาที่ผูกกับชื่อพี่เลี้ยงปัจจุบัน */
function loadStudentsByMentorName(currentMentorName: string): StudentLite[] {
  if (!currentMentorName) return [];
  const target = norm(currentMentorName);

  const raw = readAnyStudentsArrayFromLocalStorage();
  if (!raw.length) return [];

  const picked = raw.filter((r) => {
    const single = r.mentorName || r.mentor || r.companyMentor || r.coopMentor;
    const list =
      r.mentors || r.mentorList || r.coopMentors || (Array.isArray(single) ? single : null);
    if (list && Array.isArray(list)) {
      return list.map(norm).includes(target);
    }
    return norm(single) === target;
  });

  const map = new Map<string, StudentLite>();
  picked.forEach((r) => {
    const lite = toLite(r);
    if (!map.has(lite.id)) map.set(lite.id, lite);
  });
  return [...map.values()];
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

  // โหลดรายการอัตโนมัติตามชื่อพี่เลี้ยง
  useEffect(() => {
    const display =
      localStorage.getItem("coop.mentor.displayName")?.trim() ||
      (() => {
        try {
          const p = JSON.parse(localStorage.getItem("coop.mentor.profile") || "{}");
          return `${p.firstName || ""} ${p.lastName || ""}`.trim();
        } catch {
          return "";
        }
      })();

    const fromRegistry = loadStudentsByMentorName(display);
    if (fromRegistry.length) {
      setItems(fromRegistry);
      setSource("registry");
    } else {
      setItems(loadManual());
      setSource("manual");
    }
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((s) =>
      [s.firstName, s.lastName, s.major].join(" ").toLowerCase().includes(t)
    );
  }, [q, items]);

  const showAddForm = source === "manual";

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* ฟอร์มเพิ่มนักศึกษา — 3 ช่องกว้างเท่ากัน + ปุ่มต่อท้าย (แสดงเฉพาะตอนใช้ manual) */}
      {showAddForm && (
        <section className="card" style={{ padding: 24, marginBottom: 28 }}>
          <h2 style={{ marginTop: 8, marginLeft: 18 }}>เพิ่มนักศึกษาที่ดูแล</h2>

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
            placeholder="ค้นหา ชื่อ/สาขาวิชา"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 300, marginTop: 8, marginRight: 24 }}
          />
        </div>

        <div className="cards-grid" style={{ marginTop: 8, marginLeft: 50, marginBottom: 8 }}>
          {filtered.map((s) => (
            <article key={s.id} className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 800 }}>
                {s.firstName} {s.lastName}
              </div>
              {s.major && (
                <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                  {s.major}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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
          {filtered.length === 0 && <div style={{ color: "#6b7280" }}>— ไม่มีรายการ —</div>}
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
      `}</style>
    </div>
  );
}
