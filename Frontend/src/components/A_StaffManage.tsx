import React, { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import axios from "axios";

interface StaffProfile { firstName: string; lastName: string; phone: string | null; }
interface StaffUser {
  id: number;
  username: string;
  email: string | null;
  createdAt: string;
  staffProfile: StaffProfile | null;
}

const token = () => localStorage.getItem("coop.token");
const authH = () => ({ Authorization: `Bearer ${token()}` });

export default function A_StaffManage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", firstName: "", lastName: "", phone: "" });
  const [addErr, setAddErr] = useState("");
  const [adding, setAdding] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [newPw, setNewPw] = useState("");
  const [resetErr, setResetErr] = useState("");
  const [resetting, setResetting] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/admin/staff", { headers: authH() });
      if (res.data.ok) setStaff(res.data.staff);
    } catch { setError("โหลดข้อมูลไม่ได้"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddErr("");
    setAdding(true);
    try {
      const res = await axios.post("/api/admin/staff", form, { headers: authH() });
      if (res.data.ok) { setAddOpen(false); setForm({ username: "", email: "", password: "", firstName: "", lastName: "", phone: "" }); fetchStaff(); }
      else setAddErr(res.data.message || "เกิดข้อผิดพลาด");
    } catch (e: any) { setAddErr(e.response?.data?.message || "เกิดข้อผิดพลาด"); }
    finally { setAdding(false); }
  };

  const handleResetPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetErr("");
    setResetting(true);
    try {
      const res = await axios.patch(`/api/admin/staff/${resetTarget!.id}/password`, { password: newPw }, { headers: authH() });
      if (res.data.ok) { setResetTarget(null); setNewPw(""); }
      else setResetErr(res.data.message || "เกิดข้อผิดพลาด");
    } catch (e: any) { setResetErr(e.response?.data?.message || "เกิดข้อผิดพลาด"); }
    finally { setResetting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/admin/staff/${deleteTarget.id}`, { headers: authH() });
      setDeleteTarget(null);
      fetchStaff();
    } catch { }
    finally { setDeleting(false); }
  };

  return (
    <div style={{ padding: "28px 28px 28px 65px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>👤 จัดการบัญชีเจ้าหน้าที่</h2>
          <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>ทั้งหมด {staff.length} บัญชี</div>
        </div>
        <button className="btn" onClick={() => setAddOpen(true)}>+ เพิ่มเจ้าหน้าที่</button>
      </div>

      {error && <div style={{ color: "red", marginBottom: 16 }}>{error}</div>}

      <div style={card}>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>กำลังโหลด...</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["ชื่อ-นามสกุล", "Username", "อีเมล", "เบอร์โทร", "วันที่สร้าง", ""].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>ยังไม่มีบัญชีเจ้าหน้าที่</td></tr>
              )}
              {staff.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={td}>{s.staffProfile ? `${s.staffProfile.firstName} ${s.staffProfile.lastName}` : "-"}</td>
                  <td style={td}>{s.username}</td>
                  <td style={td}>{s.email || "-"}</td>
                  <td style={td}>{s.staffProfile?.phone || "-"}</td>
                  <td style={td}>{new Date(s.createdAt).toLocaleDateString("th-TH")}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button className="btn-ghost" style={{ marginRight: 8, fontSize: 13 }} onClick={() => { setResetTarget(s); setNewPw(""); setResetErr(""); }}>🔑 Reset รหัสผ่าน</button>
                    <button className="btn-ghost" style={{ color: "#ef4444", fontSize: 13 }} onClick={() => setDeleteTarget(s)}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {addOpen && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ margin: "0 0 20px" }}>เพิ่มบัญชีเจ้าหน้าที่</h3>
            <form onSubmit={handleAdd}>
              <div style={row2}>
                <Field label="ชื่อ *" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} />
                <Field label="นามสกุล *" value={form.lastName} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
              </div>
              <Field label="Username *" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} />
              <Field label="อีเมล *" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
              <Field label="รหัสผ่าน * (อย่างน้อย 6 ตัวอักษร)" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} />
              <Field label="เบอร์โทร" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
              {addErr && <div style={{ color: "red", fontSize: 13, margin: "8px 0" }}>{addErr}</div>}
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
                <button type="button" className="btn-ghost" onClick={() => setAddOpen(false)}>ยกเลิก</button>
                <button type="submit" className="btn" disabled={adding}>{adding ? "กำลังสร้าง..." : "สร้างบัญชี"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 8px" }}>🔑 Reset รหัสผ่าน</h3>
            <div style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
              {resetTarget.staffProfile?.firstName} {resetTarget.staffProfile?.lastName} ({resetTarget.username})
            </div>
            <form onSubmit={handleResetPw}>
              <Field label="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)" type="password" value={newPw} onChange={setNewPw} />
              {resetErr && <div style={{ color: "red", fontSize: 13, margin: "8px 0" }}>{resetErr}</div>}
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
                <button type="button" className="btn-ghost" onClick={() => setResetTarget(null)}>ยกเลิก</button>
                <button type="submit" className="btn" disabled={resetting}>{resetting ? "กำลังบันทึก..." : "บันทึก"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 380 }}>
            <h3 style={{ margin: "0 0 12px", color: "#dc2626" }}>⚠️ ลบบัญชีเจ้าหน้าที่</h3>
            <p style={{ margin: "0 0 20px", color: "#374151" }}>
              ยืนยันลบบัญชี <b>{deleteTarget.staffProfile?.firstName} {deleteTarget.staffProfile?.lastName}</b> ({deleteTarget.username})?
              <br /><span style={{ fontSize: 13, color: "#6b7280" }}>การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>ยกเลิก</button>
              <button className="btn" style={{ background: "#dc2626" }} onClick={handleDelete} disabled={deleting}>{deleting ? "กำลังลบ..." : "ลบบัญชี"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{label}</label>
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%" }} />
    </div>
  );
}

const card: CSSProperties = { background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0", overflow: "hidden" };
const th: CSSProperties = { padding: "12px 16px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#475569" };
const td: CSSProperties = { padding: "12px 16px", fontSize: 14, color: "#1e293b" };
const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 };
const modal: CSSProperties = { background: "#fff", borderRadius: 16, padding: 28, width: "95%", maxWidth: 520, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };
const row2: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
