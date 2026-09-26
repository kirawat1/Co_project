import { useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { notify } from "../utils/notify";
import type { CompanyContact } from "../utils/contacts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELDS: Array<[keyof CompanyContact, string, string]> = [
  ["firstName", "ชื่อ *", "เช่น สมศรี"],
  ["lastName", "นามสกุล", ""],
  ["position", "ตำแหน่ง", "เช่น HR Manager"],
  ["department", "ทีม/แผนก", "เช่น ฝ่ายบุคคล"],
  ["phone", "เบอร์โทร", ""],
  ["email", "อีเมล", ""],
];

// ฟอร์มเพิ่ม/แก้ผู้ติดต่อ (HR) — ใช้ในหน้าข้อมูลนักศึกษา หน้าบริษัท และหน้าผู้ติดต่อของเจ้าหน้าที่
export default function ContactForm({ companyId, contact, onSaved, onCancel }: {
  companyId: string;
  contact?: CompanyContact | null;
  onSaved: (c: CompanyContact) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<CompanyContact>>(contact ?? { firstName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ใช้ div ไม่ใช่ <form> — ฟอร์มนี้ไปอยู่ในฟอร์มของหน้าอื่นได้ (หน้าข้อมูลนักศึกษา) และ HTML ห้ามฟอร์มซ้อนฟอร์ม
  async function submit() {
    if (saving) return;
    const next: Record<string, string> = {};
    if (!form.firstName?.trim()) next.firstName = "กรุณากรอกชื่อ";
    if (form.email?.trim() && !EMAIL_RE.test(form.email.trim())) next.email = "รูปแบบอีเมลไม่ถูกต้อง";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const url = contact ? `/api/companies/contacts/${contact.id}` : `/api/companies/${companyId}/contacts`;
      const res = await apiFetch(url, {
        method: contact ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { notify.error(data.message || "บันทึกผู้ติดต่อไม่สำเร็จ"); return; }
      notify.success(contact ? "แก้ไขผู้ติดต่อแล้ว" : "เพิ่มผู้ติดต่อแล้ว");
      onSaved(data.contact);
    } catch {
      notify.error("บันทึกผู้ติดต่อไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally { setSaving(false); }
  }

  return (
    <div
      role="group"
      aria-label="ข้อมูลผู้ติดต่อ"
      onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); submit(); } }}
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
      {FIELDS.map(([key, label, ph]) => (
        <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
          {label}
          <input className="input" placeholder={ph} value={(form[key] as string) ?? ""}
            aria-invalid={!!errors[key]}
            onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: "" }); }} />
          {errors[key] && <span style={{ color: "#dc2626", fontSize: 12, fontWeight: 500 }}>{errors[key]}</span>}
        </label>
      ))}
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>ยกเลิก</button>
        <button type="button" className="btn" disabled={saving} onClick={submit}>{saving ? "กำลังบันทึก..." : "💾 บันทึกผู้ติดต่อ"}</button>
      </div>
    </div>
  );
}
