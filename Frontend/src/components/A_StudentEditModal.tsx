import { useState, useEffect, useRef } from "react";
import type { StudentProfile } from "./A_Students";

const CURRICULUM_TH: Record<string, string> = {
  normal: "ภาคปกติ",
  special: "ภาคพิเศษ",
};

interface TeacherOption {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
}

interface Props {
  student: StudentProfile;
  majors: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

export default function A_StudentEditModal({ student, majors, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    prefix: student.prefix ?? "",
    firstName: student.firstName ?? "",
    lastName: student.lastName ?? "",
    firstNameEn: student.firstNameEn ?? "",
    lastNameEn: student.lastNameEn ?? "",
    studentId: student.studentId ?? "",
    major: student.major ?? "",
    studyProgram: student.studyProgram ?? "",
    year: student.year ?? "",
    phone: student.phone ?? "",
    email: student.user?.email ?? "",
    jobPosition: student.jobPosition ?? "",
  });
  const [generalAdvisorId, setGeneralAdvisorId] = useState<number | null>(
    student.generalAdvisorId ?? student.generalAdvisor?.id ?? null
  );
  const [coopAdvisorId, setCoopAdvisorId] = useState<number | null>(
    student.coopAdvisorId ?? student.coopAdvisor?.id ?? null
  );
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("coop.token");
    fetch("/api/teacher", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setTeachers(Array.isArray(data) ? data : []))
      .catch(() => setTeachers([]));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, generalAdvisorId, coopAdvisorId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlay}>
      <form style={modal} onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>แก้ไขข้อมูลนักศึกษา</h2>

        {error && <div style={{ color: "#dc2626", marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={grid}>
          <Field label="คำนำหน้า">
            <select style={input} value={form.prefix} onChange={e => update("prefix", e.target.value)}>
              <option value="">เลือก</option>
              <option value="MR">นาย</option>
              <option value="MS">นางสาว</option>
            </select>
          </Field>
          <Field label="รหัสนักศึกษา">
            <input style={input} value={form.studentId} onChange={e => update("studentId", e.target.value)} required />
          </Field>
          <Field label="ชื่อ">
            <input style={input} value={form.firstName} onChange={e => update("firstName", e.target.value)} required />
          </Field>
          <Field label="นามสกุล">
            <input style={input} value={form.lastName} onChange={e => update("lastName", e.target.value)} required />
          </Field>
          <Field label="ชื่อ (English)">
            <input style={input} value={form.firstNameEn} onChange={e => update("firstNameEn", e.target.value)} />
          </Field>
          <Field label="นามสกุล (English)">
            <input style={input} value={form.lastNameEn} onChange={e => update("lastNameEn", e.target.value)} />
          </Field>
          <Field label="สาขาวิชา">
            <select style={input} value={form.major} onChange={e => update("major", e.target.value)}>
              <option value="">-</option>
              {Object.keys(majors).map(m => <option key={m} value={m}>{majors[m]}</option>)}
            </select>
          </Field>
          <Field label="หลักสูตร">
            <select style={input} value={form.studyProgram} onChange={e => update("studyProgram", e.target.value)}>
              <option value="">-</option>
              {Object.entries(CURRICULUM_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="ชั้นปี">
            <input style={input} value={form.year} onChange={e => update("year", e.target.value)} />
          </Field>
          <Field label="เบอร์โทร">
            <input style={input} value={form.phone} onChange={e => update("phone", e.target.value)} />
          </Field>
          <Field label="อีเมล">
            <input style={input} type="email" value={form.email} onChange={e => update("email", e.target.value)} />
          </Field>
          <Field label="อาจารย์ที่ปรึกษาปกติ">
            <TeacherSearchInput
              teachers={teachers}
              value={generalAdvisorId}
              onChange={setGeneralAdvisorId}
              placeholder="พิมพ์ชื่อเพื่อค้นหา..."
            />
          </Field>
          <Field label="อาจารย์ที่ปรึกษาโครงการ">
            <TeacherSearchInput
              teachers={teachers}
              value={coopAdvisorId}
              onChange={setCoopAdvisorId}
              placeholder="พิมพ์ชื่อเพื่อค้นหา..."
            />
          </Field>
          <Field label="ตำแหน่งงานที่สนใจ">
            <input style={input} value={form.jobPosition} onChange={e => update("jobPosition", e.target.value)} />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button type="button" style={ghostBtn} onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button type="submit" style={saveBtn} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

// พิมพ์ค้นหาอาจารย์จากรายชื่อ แล้วเลือกเพื่อผูก FK (generalAdvisorId / coopAdvisorId) จริง
// แทนช่อง text เดิมที่แก้แล้วไม่มีผลอะไรกับระบบ (ดูเหมือนแก้ได้แต่ข้อมูลจริงไม่เปลี่ยน)
function TeacherSearchInput({
  teachers, value, onChange, placeholder,
}: {
  teachers: TeacherOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
}) {
  const selected = teachers.find(t => t.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const displayValue = open ? query : (selected ? `${selected.firstName} ${selected.lastName}` : "");
  const q = query.trim().toLowerCase();
  const matches = q
    ? teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(q)).slice(0, 8)
    : teachers.slice(0, 8);

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        style={input}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
      />
      {selected && !open && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="ล้างค่า"
          style={{ position: "absolute", right: 6, top: 6, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}
        >
          ✕
        </button>
      )}
      {open && (
        <div style={{ position: "absolute", zIndex: 10, top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,.08)" }}>
          {matches.length === 0 ? (
            <div style={{ padding: "8px 10px", fontSize: 13, color: "#94a3b8" }}>ไม่พบอาจารย์ที่ตรงกับคำค้น</div>
          ) : (
            matches.map(t => (
              <div
                key={t.id}
                onClick={() => { onChange(t.id); setQuery(""); setOpen(false); }}
                style={{ padding: "8px 10px", fontSize: 13, cursor: "pointer", background: t.id === value ? "#eff6ff" : "transparent" }}
                onMouseDown={e => e.preventDefault()}
              >
                {t.firstName} {t.lastName}{t.email ? ` (${t.email})` : ""}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 700, border: "1px solid #e5e7eb", maxHeight: "85vh", overflowY: "auto" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 };
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: "0 16px", cursor: "pointer" };
const saveBtn: React.CSSProperties = { background: "#0074B7", color: "#fff", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: "0 16px", cursor: "pointer" };
