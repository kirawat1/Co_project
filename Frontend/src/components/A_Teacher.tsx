import { useState, useEffect, useMemo } from "react";
import { IcEdit, IcSave, IcUser } from "./icons";
import { useToast } from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import Spinner from "./Spinner";

/* =========================
   Types
========================= */
interface Teacher {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  faculty: string;
  major: string;
  userId?: number;
  isCoopTeacher: boolean;
}

const MAJOR_TH: Record<string, string> = {
  CS: "วิทยาการคอมพิวเตอร์",
  IT: "เทคโนโลยีสารสนเทศ",
  GIS: "ภูมิสารสนเทศศาสตร์",
};
const FACULTY_DEFAULT = "วิทยาลัยการคอมพิวเตอร์";

const EMPTY_TEACHER: Omit<Teacher, "id"> = {
  firstName: "", lastName: "", email: "",
  phone: "", faculty: FACULTY_DEFAULT, major: "",
  isCoopTeacher: false,
};

/* =========================
   Main Component
========================= */
export default function A_Teacher() {
  const toast = useToast();
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [majorOptions, setMajorOptions] = useState<string[]>([]);

  // Filters
  const [q, setQ] = useState("");
  const [filterMajor, setFilterMajor] = useState<string[]>([]);

  // Modals
  const [editModal, setEditModal] = useState<Teacher | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_TEACHER);
  const [pwModal, setPwModal] = useState<Teacher | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // ConfirmDialog
  const [confirmDel, setConfirmDel] = useState<Teacher | null>(null);

  const token = localStorage.getItem("coop.token");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/teacher", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setItems((Array.isArray(data) ? data : []).map((t: any) => ({
          ...t, email: t.user?.email || t.email || "", major: t.major || t.department,
          isCoopTeacher: t.isCoopTeacher ?? false,
        })));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchMajors = async () => {
    try {
      const res = await fetch("/api/admin/majors", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setMajorOptions(data.majors);
    } catch {}
  };

  useEffect(() => { fetchData(); fetchMajors(); }, []);

  // ─── CRUD handlers ────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.firstName || !createForm.lastName || !createForm.email) {
      toast.warning("กรุณากรอกชื่อ นามสกุล และอีเมล");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`เพิ่มอาจารย์ ${createForm.firstName} ${createForm.lastName} สำเร็จ`);
        setCreateModal(false);
        setCreateForm(EMPTY_TEACHER);
        fetchData();
      } else {
        toast.error(data.message || "เพิ่มอาจารย์ไม่สำเร็จ");
      }
    } catch { toast.error("เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (updated: Teacher) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/teachers/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("บันทึกข้อมูลเรียบร้อย");
        setEditModal(null);
        fetchData();
      } else {
        toast.error(data.message || "บันทึกไม่สำเร็จ");
      }
    } catch { toast.error("เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: Teacher) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/teachers/${t.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`ลบ ${t.firstName} ${t.lastName} เรียบร้อย`);
        fetchData();
      } else {
        toast.error(data.message || "ลบไม่สำเร็จ");
      }
    } catch { toast.error("เกิดข้อผิดพลาด"); }
    finally { setSaving(false); setConfirmDel(null); }
  };

  const handleResetPassword = async () => {
    if (!pwModal) return;
    if (!newPassword || newPassword.length < 6) {
      toast.warning("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/teachers/${pwModal.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`รีเซ็ตรหัสผ่าน ${pwModal.firstName} ${pwModal.lastName} สำเร็จ`);
        setPwModal(null);
        setNewPassword("");
      } else {
        toast.error(data.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
      }
    } catch { toast.error("เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  };

  // ─── filter ───────────────────────────────────────────────
  const majorDict = useMemo(() => {
    const dict: Record<string, string> = {};
    majorOptions.forEach(m => dict[m] = m);
    if (!majorOptions.includes("CS")) dict["CS"] = "วิทยาการคอมพิวเตอร์ (CS)";
    if (!majorOptions.includes("IT")) dict["IT"] = "เทคโนโลยีสารสนเทศ (IT)";
    if (!majorOptions.includes("GIS")) dict["GIS"] = "ภูมิสารสนเทศศาสตร์ (GIS)";
    return dict;
  }, [majorOptions]);

  const filtered = useMemo(() => items.filter((t) => {
    const text = `${t.firstName} ${t.lastName} ${t.email} ${t.phone}`.toLowerCase();
    return text.includes(q.toLowerCase()) &&
      (filterMajor.length === 0 || filterMajor.includes(t.major || ""));
  }), [items, q, filterMajor]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>กำลังโหลดข้อมูลอาจารย์...</div>;

  return (
    <div style={{ padding: 28, marginLeft: 35 }}>

      {/* ─── Delete Confirm ─── */}
      <ConfirmDialog
        open={!!confirmDel}
        title="ยืนยันการลบอาจารย์"
        message={`ลบ "${confirmDel?.firstName} ${confirmDel?.lastName}" ออกจากระบบ? การดำเนินการนี้จะลบบัญชีผู้ใช้ด้วย`}
        icon="🗑️"
        confirmLabel="ลบ"
        confirmColor="#ef4444"
        onConfirm={() => confirmDel && handleDelete(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />

      {/* ─── Filters ─── */}
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>จัดการข้อมูลอาจารย์</h2>
          <button style={addBtn} onClick={() => { setCreateForm(EMPTY_TEACHER); setCreateModal(true); }}>
            + เพิ่มอาจารย์
          </button>
        </div>

        <div style={filterRow}>
          <input className="input" placeholder="ค้นหา: ชื่อ / อีเมล / เบอร์โทร"
            value={q} onChange={(e) => setQ(e.target.value)}
            style={{ width: 280, padding: "8px", borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <FilterBox title="สาขาวิชา" items={majorDict} values={filterMajor} onChange={setFilterMajor} />
          <button className="btn" style={{ ...saveBtn, marginLeft: "auto" }} onClick={() => { setQ(""); setFilterMajor([]); }}>
            ล้างตัวกรอง
          </button>
        </div>
      </section>

      {/* ─── Table ─── */}
      <section style={{ ...card, marginTop: 20, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", color: "#64748b", fontSize: 13 }}>
          ทั้งหมด {filtered.length} คน
        </div>
        <table width="100%" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["ชื่อ-นามสกุล", "อีเมล (Username)", "เบอร์โทร", "สาขา", "จัดการ"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>ไม่พบข้อมูลอาจารย์</td></tr>
            ) : filtered.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IcUser width={16} height={16} style={{ color: "#0074B7" }} />
                    </div>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{t.firstName} {t.lastName}</span>
                    {t.isCoopTeacher && (
                      <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginLeft: 6 }}>
                        ประจำวิชาสหกิจ
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ ...td, color: "#0369a1" }}>{t.email}</td>
                <td style={td}>{t.phone || "-"}</td>
                <td style={td}>
                  <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: t.major ? "#f0f9ff" : "#f1f5f9", color: t.major ? "#0369a1" : "#64748b" }}>
                    {MAJOR_TH[t.major] || t.major || "-"}
                  </span>
                </td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={ghostBtn} onClick={() => setEditModal(t)}>
                      ✏️ แก้ไข
                    </button>
                    <button style={{ ...ghostBtn, color: "#7c3aed", borderColor: "#7c3aed" }} onClick={() => { setPwModal(t); setNewPassword(""); }}>
                      🔑 รหัสผ่าน
                    </button>
                    <button style={{ ...ghostBtn, color: "#ef4444", borderColor: "#ef4444" }} onClick={() => setConfirmDel(t)}>
                      🗑️ ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ─── Edit Modal ─── */}
      {editModal && (
        <TeacherFormModal
          title="แก้ไขข้อมูลอาจารย์"
          data={editModal}
          majorOptions={majorOptions}
          saving={saving}
          onClose={() => setEditModal(null)}
          onSave={handleUpdate}
          allowEmailEdit
        />
      )}

      {/* ─── Create Modal ─── */}
      {createModal && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>➕ เพิ่มอาจารย์ใหม่</h2>
              <button onClick={() => setCreateModal(false)} style={closeBtn}>✕</button>
            </div>
            <div style={{ background: "#eff6ff", padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13, color: "#1e40af" }}>
              📌 รหัสผ่านเริ่มต้น: <strong>1111111111111</strong> (อาจารย์แก้ไขเองได้ภายหลัง)
            </div>
            <TeacherFields form={createForm} setForm={setCreateForm} majorOptions={majorOptions} allowEmailEdit />
            <div style={modalFooter}>
              <button style={ghostBtn} onClick={() => setCreateModal(false)}>ยกเลิก</button>
              <button style={{ ...saveBtn, display: "flex", alignItems: "center", gap: 8 }} onClick={handleCreate} disabled={saving}>
                {saving ? <><Spinner size={16} color="#fff" /> กำลังบันทึก...</> : "✅ เพิ่มอาจารย์"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reset Password Modal ─── */}
      {pwModal && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>🔑 รีเซ็ตรหัสผ่าน</h2>
              <button onClick={() => setPwModal(null)} style={closeBtn}>✕</button>
            </div>
            <div style={{ marginBottom: 16, padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: 14, color: "#475569" }}>
              อาจารย์: <strong>{pwModal.firstName} {pwModal.lastName}</strong><br />
              อีเมล: <strong>{pwModal.email}</strong>
            </div>
            <label style={labelStyle}>รหัสผ่านใหม่ <span style={{ color: "red" }}>*</span></label>
            <input
              type="password"
              style={inputStyle}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="ขั้นต่ำ 6 ตัวอักษร"
              autoFocus
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
              💡 แนะนำ: ตั้งเป็นเลขบัตรประชาชน 13 หลักของอาจารย์
            </div>
            <div style={modalFooter}>
              <button style={ghostBtn} onClick={() => setPwModal(null)}>ยกเลิก</button>
              <button style={{ ...saveBtn, background: "#7c3aed", display: "flex", alignItems: "center", gap: 8 }} onClick={handleResetPassword} disabled={saving}>
                {saving ? <><Spinner size={16} color="#fff" /> กำลังบันทึก...</> : "🔑 บันทึกรหัสผ่าน"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* =========================
   TeacherFormModal
========================= */
function TeacherFormModal({ title, data, majorOptions, saving, onClose, onSave, allowEmailEdit }: {
  title: string;
  data: Teacher;
  majorOptions: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (d: Teacher) => void;
  allowEmailEdit?: boolean;
}) {
  const [form, setForm] = useState<Teacher>(data);
  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <TeacherFields form={form} setForm={setForm} majorOptions={majorOptions} allowEmailEdit={allowEmailEdit} />
        <div style={modalFooter}>
          <button style={ghostBtn} onClick={onClose}>ยกเลิก</button>
          <button style={{ ...saveBtn, display: "flex", alignItems: "center", gap: 8 }} onClick={() => onSave(form)} disabled={saving}>
            {saving ? <><Spinner size={16} color="#fff" /> กำลังบันทึก...</> : <><IcSave width={16} height={16} /> บันทึกข้อมูล</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   TeacherFields — form fields (shared)
========================= */
function TeacherFields({ form, setForm, majorOptions, allowEmailEdit }: {
  form: any;
  setForm: (f: any) => void;
  majorOptions: string[];
  allowEmailEdit?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <label style={labelStyle}>ชื่อ *</label>
        <input style={inputStyle} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="ชื่อจริง" />
      </div>
      <div>
        <label style={labelStyle}>นามสกุล *</label>
        <input style={inputStyle} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="นามสกุล" />
      </div>
      <div style={{ gridColumn: "span 2" }}>
        <label style={labelStyle}>อีเมล (ใช้เป็น Username) *</label>
        <input
          style={{ ...inputStyle, ...(!allowEmailEdit ? { background: "#f1f5f9", color: "#94a3b8" } : {}) }}
          value={form.email}
          disabled={!allowEmailEdit}
          onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="example@kku.ac.th"
          type="email"
        />
      </div>
      <div>
        <label style={labelStyle}>เบอร์โทร</label>
        <input style={inputStyle} value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0XX-XXXXXXX" />
      </div>
      <div>
        <label style={labelStyle}>คณะ</label>
        <input style={inputStyle} value={form.faculty || ""} placeholder={FACULTY_DEFAULT} onChange={e => setForm({ ...form, faculty: e.target.value })} />
      </div>
      <div style={{ gridColumn: "span 2" }}>
        <label style={labelStyle}>สาขาวิชา</label>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={form.major || ""} onChange={e => setForm({ ...form, major: e.target.value })}>
          <option value="">-- เลือกสาขาวิชา --</option>
          {majorOptions.map(m => <option key={m} value={m}>{m}</option>)}
          {form.major && !majorOptions.includes(form.major) && (
            <option value={form.major}>{MAJOR_TH[form.major] || form.major}</option>
          )}
        </select>
      </div>
      {/* อาจารย์ประจำวิชาสหกิจ */}
      <div style={{ gridColumn: "span 2", display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f1f5f9', marginTop: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>อาจารย์ประจำวิชาสหกิจ</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>เห็นนักศึกษาทั้งหมดและจัดการนิเทศได้</div>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.isCoopTeacher ?? false}
            onChange={e => setForm({ ...form, isCoopTeacher: e.target.checked })}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 24,
            background: form.isCoopTeacher ? '#2563eb' : '#cbd5e1',
            transition: '0.2s',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: form.isCoopTeacher ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </span>
        </label>
      </div>
    </div>
  );
}

/* =========================
   FilterBox
========================= */
function FilterBox({ title, items, values, onChange }: { title: string; items: Record<string, string>; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 6, fontWeight: 600 }}>{title}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {Object.entries(items).map(([k, v]) => (
          <label key={k} style={{ fontSize: 13, cursor: "pointer", display: "flex", gap: 6, alignItems: "center", color: "#334155" }}>
            <input type="checkbox" checked={values.includes(k)} onChange={(e) => onChange(e.target.checked ? [...values, k] : values.filter(x => x !== k))} style={{ accentColor: "#0074B7", width: 16, height: 16 }} />
            {v}
          </label>
        ))}
      </div>
    </div>
  );
}

/* =========================
   Styles
========================= */
import React from "react";
const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e5e7eb" };
const filterRow: React.CSSProperties = { display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 14, fontWeight: 700, padding: "12px 16px", color: "#475569" };
const td: React.CSSProperties = { padding: "14px 16px", fontSize: 14, color: "#334155", verticalAlign: "middle" };
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", border: "1px solid rgba(10,132,255,.25)", height: 34, borderRadius: 8, padding: "0 12px", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const saveBtn: React.CSSProperties = { background: "#0074B7", color: "#fff", border: "none", height: 38, borderRadius: 8, padding: "0 16px", cursor: "pointer", fontWeight: 600, fontSize: 14 };
const addBtn: React.CSSProperties = { background: "#10b981", color: "#fff", border: "none", height: 38, borderRadius: 10, padding: "0 20px", cursor: "pointer", fontWeight: 700, fontSize: 14 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 20, padding: 32, width: 600, maxWidth: "95%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
const modalFooter: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 28 };
const closeBtn: React.CSSProperties = { background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15, boxSizing: "border-box", fontFamily: "inherit" };
