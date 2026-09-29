// Frontend/src/components/A_AddStudentModal.tsx
import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { notify } from "../utils/notify";
import Modal from "./Modal";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

interface Department {
  major: string;
  nameTh: string | null;
}

const LBL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 3 };
const REQ: React.CSSProperties = { color: "#ef4444", marginLeft: 2 };

export default function A_AddStudentModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    studentId: "", prefix: "MS", firstName: "", lastName: "",
    firstNameEn: "", lastNameEn: "", email: "", phone: "",
    major: "", studyProgram: "normal", year: "", advisorName: "",
  });
  const [loading, setLoading] = useState(false);
  // สาขาวิชาจากหน้าจัดการสาขาวิชา (admin/criteria) — เลือกแทนพิมพ์เอง ให้เก็บเป็นรหัสสาขาเดียวกันทั้งระบบ
  const [departments, setDepartments] = useState<Department[] | null>(null);

  useEffect(() => {
    apiFetch("/api/coop/departments")
      .then(r => (r.ok ? r.json() : null))
      .then(d => setDepartments(d?.ok && Array.isArray(d.departments) ? d.departments : []))
      .catch(() => setDepartments([]));
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.studentId.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      return notify.warning("กรุณากรอกข้อมูลที่จำเป็น: รหัสนักศึกษา, ชื่อ, นามสกุล, อีเมล");
    }
    if (!/^[^@\s]+@(kkumail\.com|kku\.ac\.th)$/i.test(form.email.trim())) {
      return notify.warning("กรุณาใช้อีเมล @kkumail.com หรือ @kku.ac.th");
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/students/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return notify.error(data.message || "เกิดข้อผิดพลาด");
      notify.success("✅ เพิ่มนักศึกษาเรียบร้อย");
      onSuccess();
    } catch (err: any) {
      notify.error("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="เพิ่มนักศึกษาทีละคน" onClose={onClose} maxWidth={560}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
          {/* รหัสนักศึกษา */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={LBL}>รหัสนักศึกษา<span style={REQ}>*</span></label>
            <input className="input" value={form.studentId} onChange={set("studentId")} placeholder="เช่น 643050001-8" />
          </div>

          {/* คำนำหน้า + ชื่อไทย */}
          <div>
            <label style={LBL}>คำนำหน้า</label>
            <select className="input" value={form.prefix} onChange={set("prefix")}>
              <option value="MR">นาย</option>
              <option value="MS">นางสาว</option>
            </select>
          </div>
          <div />

          <div>
            <label style={LBL}>ชื่อ (ไทย)<span style={REQ}>*</span></label>
            <input className="input" value={form.firstName} onChange={set("firstName")} placeholder="ชื่อ" />
          </div>
          <div>
            <label style={LBL}>นามสกุล (ไทย)<span style={REQ}>*</span></label>
            <input className="input" value={form.lastName} onChange={set("lastName")} placeholder="นามสกุล" />
          </div>

          <div>
            <label style={LBL}>ชื่อ (อังกฤษ)</label>
            <input className="input" value={form.firstNameEn} onChange={set("firstNameEn")} placeholder="First name" />
          </div>
          <div>
            <label style={LBL}>นามสกุล (อังกฤษ)</label>
            <input className="input" value={form.lastNameEn} onChange={set("lastNameEn")} placeholder="Last name" />
          </div>

          {/* อีเมล */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={LBL}>อีเมล (สำหรับ Google Login)<span style={REQ}>*</span></label>
            <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="xxxxx@kkumail.com หรือ @kku.ac.th" />
          </div>

          {/* เบอร์โทร */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={LBL}>เบอร์โทรศัพท์</label>
            <input className="input" value={form.phone} onChange={set("phone")} placeholder="0812345678" />
          </div>

          {/* สาขา + แผนการศึกษา */}
          <div>
            <label style={LBL}>หลักสูตร</label>
            <select className="input" value={form.major} onChange={set("major")} disabled={departments === null}>
              <option value="">{departments === null ? "กำลังโหลด..." : "-- เลือกหลักสูตร --"}</option>
              {(departments ?? []).map(d => (
                <option key={d.major} value={d.major}>
                  {d.nameTh && d.nameTh !== d.major ? `${d.nameTh} (${d.major})` : d.major}
                </option>
              ))}
            </select>
            {departments !== null && departments.length === 0 && (
              <div style={{ fontSize: 11, color: "#b45309", marginTop: 3 }}>ยังไม่มีหลักสูตร — เพิ่มที่เมนู "จัดการหลักสูตร"</div>
            )}
          </div>
          <div>
            <label style={LBL}>รูปแบบการศึกษา</label>
            <select className="input" value={form.studyProgram} onChange={set("studyProgram")}>
              <option value="normal">ภาคปกติ</option>
              <option value="special">ภาคพิเศษ</option>
            </select>
          </div>

          {/* ชั้นปี (ไม่เก็บ GPA แล้ว) */}
          <div>
            <label style={LBL}>ชั้นปี</label>
            <input className="input" value={form.year} onChange={set("year")} placeholder="3 หรือ 4" />
          </div>

          {/* อาจารย์ที่ปรึกษา */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={LBL}>ชื่ออาจารย์ที่ปรึกษา</label>
            <input className="input" value={form.advisorName} onChange={set("advisorName")} placeholder="เช่น อ.ดร.สมชาย ใจดี" />
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            className="btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "กำลังบันทึก..." : "เพิ่มนักศึกษา"}
          </button>
        </div>
    </Modal>
  );
}
