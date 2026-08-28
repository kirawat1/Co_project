// Frontend/src/components/A_AddStudentModal.tsx
import { useState } from "react";
import { apiFetch } from "../utils/apiFetch";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "7px 10px", border: "1px solid #cbd5e1",
  borderRadius: 6, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
};
const LBL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 3 };
const REQ: React.CSSProperties = { color: "#ef4444", marginLeft: 2 };

export default function A_AddStudentModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    studentId: "", prefix: "MS", firstName: "", lastName: "",
    firstNameEn: "", lastNameEn: "", email: "", phone: "",
    major: "", studyProgram: "normal", year: "", gpa: "", advisorName: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.studentId.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      return alert("กรุณากรอกข้อมูลที่จำเป็น: รหัสนักศึกษา, ชื่อ, นามสกุล, อีเมล");
    }
    if (!/^[^@\s]+@(kkumail\.com|kku\.ac\.th)$/i.test(form.email.trim())) {
      return alert("กรุณาใช้อีเมล @kkumail.com หรือ @kku.ac.th");
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/students/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.message || "เกิดข้อผิดพลาด");
      alert("✅ เพิ่มนักศึกษาเรียบร้อย");
      onSuccess();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>เพิ่มนักศึกษาทีละคน</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#64748b" }}>&times;</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
          {/* รหัสนักศึกษา */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={LBL}>รหัสนักศึกษา<span style={REQ}>*</span></label>
            <input style={FIELD_STYLE} value={form.studentId} onChange={set("studentId")} placeholder="เช่น 643050001-8" />
          </div>

          {/* คำนำหน้า + ชื่อไทย */}
          <div>
            <label style={LBL}>คำนำหน้า</label>
            <select style={FIELD_STYLE} value={form.prefix} onChange={set("prefix")}>
              <option value="MR">นาย</option>
              <option value="MS">นางสาว</option>
            </select>
          </div>
          <div />

          <div>
            <label style={LBL}>ชื่อ (ไทย)<span style={REQ}>*</span></label>
            <input style={FIELD_STYLE} value={form.firstName} onChange={set("firstName")} placeholder="ชื่อ" />
          </div>
          <div>
            <label style={LBL}>นามสกุล (ไทย)<span style={REQ}>*</span></label>
            <input style={FIELD_STYLE} value={form.lastName} onChange={set("lastName")} placeholder="นามสกุล" />
          </div>

          <div>
            <label style={LBL}>ชื่อ (อังกฤษ)</label>
            <input style={FIELD_STYLE} value={form.firstNameEn} onChange={set("firstNameEn")} placeholder="First name" />
          </div>
          <div>
            <label style={LBL}>นามสกุล (อังกฤษ)</label>
            <input style={FIELD_STYLE} value={form.lastNameEn} onChange={set("lastNameEn")} placeholder="Last name" />
          </div>

          {/* อีเมล */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={LBL}>อีเมล (สำหรับ Google Login)<span style={REQ}>*</span></label>
            <input style={FIELD_STYLE} type="email" value={form.email} onChange={set("email")} placeholder="xxxxx@kkumail.com หรือ @kku.ac.th" />
          </div>

          {/* เบอร์โทร */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={LBL}>เบอร์โทรศัพท์</label>
            <input style={FIELD_STYLE} value={form.phone} onChange={set("phone")} placeholder="0812345678" />
          </div>

          {/* สาขา + แผนการศึกษา */}
          <div>
            <label style={LBL}>สาขาวิชา / หลักสูตร</label>
            <input style={FIELD_STYLE} value={form.major} onChange={set("major")} placeholder="เช่น วิทยาการคอมพิวเตอร์" />
          </div>
          <div>
            <label style={LBL}>แผนการศึกษา</label>
            <select style={FIELD_STYLE} value={form.studyProgram} onChange={set("studyProgram")}>
              <option value="normal">ภาคปกติ</option>
              <option value="special">ภาคพิเศษ</option>
            </select>
          </div>

          {/* ชั้นปี + GPA */}
          <div>
            <label style={LBL}>ชั้นปี</label>
            <input style={FIELD_STYLE} value={form.year} onChange={set("year")} placeholder="3 หรือ 4" />
          </div>
          <div>
            <label style={LBL}>เกรดเฉลี่ยสะสม (GPA)</label>
            <input style={FIELD_STYLE} type="number" step="0.01" min="0" max="4" value={form.gpa} onChange={set("gpa")} placeholder="3.50" />
          </div>

          {/* อาจารย์ที่ปรึกษา */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={LBL}>ชื่ออาจารย์ที่ปรึกษา</label>
            <input style={FIELD_STYLE} value={form.advisorName} onChange={set("advisorName")} placeholder="เช่น อ.ดร.สมชาย ใจดี" />
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13 }}>
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ padding: "9px 24px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "กำลังบันทึก..." : "เพิ่มนักศึกษา"}
          </button>
        </div>
      </div>
    </div>
  );
}
