import { useState, useEffect, useRef } from "react";
import type { StudentProfile } from "./A_Students";
import { apiFetch } from "../utils/apiFetch";
import { askConfirm } from "../utils/notify";
import Modal from "./Modal";

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

interface Department {
  major: string;
  nameTh: string | null;
}

interface Props {
  student: StudentProfile;
  onClose: () => void;
  onSaved: () => void;
}

export default function A_StudentEditModal({ student, onClose, onSaved }: Props) {
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
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("coop.token");
    apiFetch("/api/teacher", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) return null; return res.json(); })
      .then(data => data && setTeachers(Array.isArray(data) ? data : []))
      .catch(() => setTeachers([]));
    apiFetch("/api/coop/departments")
      .then(res => (res.ok ? res.json() : null))
      .then(data => setDepartments(data?.ok && Array.isArray(data.departments) ? data.departments : []))
      .catch(() => setDepartments([]));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/students/${student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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

  // ใช้รหัสนักศึกษาที่บันทึกในระบบ (ฝั่ง server อ่านจาก DB) ไม่ใช่ค่าที่กำลังแก้ในฟอร์ม
  async function handleResetPassword() {
    if (!(await askConfirm(`รีเซ็ตรหัสผ่านของ ${student.firstName ?? ""} ${student.lastName ?? ""} เป็นรหัสนักศึกษา (${student.studentId})?\nรหัสผ่านเดิมจะใช้ไม่ได้อีก`, { title: "รีเซ็ตรหัสผ่าน", confirmLabel: "รีเซ็ตรหัสผ่าน", danger: true, icon: "🔑" }))) return;
    setResetting(true);
    setResetResult(null);
    try {
      const res = await apiFetch(`/api/admin/students/${student.id}/reset-password`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      setResetResult({ ok: !!(res.ok && data.ok), message: data.message || (res.ok ? "รีเซ็ตรหัสผ่านเรียบร้อย" : "รีเซ็ตรหัสผ่านไม่สำเร็จ") });
    } catch (err: any) {
      setResetResult({ ok: false, message: err.message || "เกิดข้อผิดพลาด" });
    } finally {
      setResetting(false);
    }
  }

  return (
    <Modal title="แก้ไขข้อมูลนักศึกษา" onClose={onClose} maxWidth={700}>
      <form onSubmit={handleSubmit}>
        {error && <div style={{ color: "#dc2626", marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={grid}>
          <Field label="คำนำหน้า">
            <select className="input" value={form.prefix} onChange={e => update("prefix", e.target.value)}>
              <option value="">เลือก</option>
              <option value="MR">นาย</option>
              <option value="MS">นางสาว</option>
            </select>
          </Field>
          <Field label="รหัสนักศึกษา">
            <input className="input" value={form.studentId} onChange={e => update("studentId", e.target.value)} required />
          </Field>
          <Field label="ชื่อ">
            <input className="input" value={form.firstName} onChange={e => update("firstName", e.target.value)} required />
          </Field>
          <Field label="นามสกุล">
            <input className="input" value={form.lastName} onChange={e => update("lastName", e.target.value)} required />
          </Field>
          <Field label="ชื่อ (English)">
            <input className="input" value={form.firstNameEn} onChange={e => update("firstNameEn", e.target.value)} />
          </Field>
          <Field label="นามสกุล (English)">
            <input className="input" value={form.lastNameEn} onChange={e => update("lastNameEn", e.target.value)} />
          </Field>
          <Field label="หลักสูตร">
            <select className="input" value={form.major} onChange={e => update("major", e.target.value)} disabled={departments === null}>
              <option value="">{departments === null ? "กำลังโหลด..." : "-- ยังไม่ระบุหลักสูตร --"}</option>
              {(departments ?? []).map(d => (
                <option key={d.major} value={d.major}>{d.nameTh && d.nameTh !== d.major ? `${d.nameTh} (${d.major})` : d.major}</option>
              ))}
            </select>
          </Field>
          <Field label="รูปแบบการศึกษา">
            <select className="input" value={form.studyProgram} onChange={e => update("studyProgram", e.target.value)}>
              <option value="">-</option>
              {Object.entries(CURRICULUM_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="ชั้นปี">
            <input className="input" value={form.year} onChange={e => update("year", e.target.value)} />
          </Field>
          <Field label="เบอร์โทร">
            <input className="input" value={form.phone} onChange={e => update("phone", e.target.value)} />
          </Field>
          <Field label="อีเมล">
            <input className="input" type="email" value={form.email} onChange={e => update("email", e.target.value)} />
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
            <input className="input" value={form.jobPosition} onChange={e => update("jobPosition", e.target.value)} />
          </Field>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>รหัสผ่านเข้าสู่ระบบ</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn-secondary" onClick={handleResetPassword} disabled={resetting || saving}>
              {resetting ? "กำลังรีเซ็ต..." : "🔑 รีเซ็ตรหัสผ่านเป็นรหัสนักศึกษา"}
            </button>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>ใช้เมื่อนักศึกษาลืมรหัสผ่าน</span>
          </div>
          {resetResult && (
            <div style={{ marginTop: 8, fontSize: 13, color: resetResult.ok ? "#15803d" : "#dc2626" }}>{resetResult.message}</div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button type="submit" className="btn" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>
      </form>
    </Modal>
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
        className="input"
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
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}
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

const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 };
