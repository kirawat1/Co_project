import { useEffect, useState } from "react";
import type { StudentProfile } from "./A_Students";

export default function A_StudentTrash() {
  const [items, setItems] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch("/api/admin/students/trash", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setItems(data.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestore = async (s: StudentProfile) => {
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch(`/api/admin/students/${s.id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "กู้คืนไม่สำเร็จ");
        return;
      }
      fetchTrash();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };

  const handlePermanentDelete = async (s: StudentProfile) => {
    if (confirmText.trim() !== s.studentId) {
      alert("กรุณาพิมพ์รหัสนักศึกษาให้ตรงกันก่อนยืนยัน");
      return;
    }
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch(`/api/admin/students/${s.id}/permanent`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "ลบถาวรไม่สำเร็จ");
        return;
      }
      setConfirmId(null);
      setConfirmText("");
      fetchTrash();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };

  if (loading) return <div style={{ padding: 20 }}>กำลังโหลด...</div>;

  return (
    <section style={card}>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>ถังขยะ</h2>
      {items.length === 0 ? (
        <div style={{ color: "#64748b", padding: 20, textAlign: "center" }}>ถังขยะว่าง</div>
      ) : (
        <table width="100%" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["รหัส", "ชื่อ–นามสกุล", "อีเมล", "การจัดการ"].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={td}>{s.studentId}</td>
                <td style={td}>{s.firstName} {s.lastName}</td>
                <td style={td}>{s.user?.email || "-"}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button style={ghostBtn} onClick={() => handleRestore(s)}>กู้คืน</button>
                    {confirmId === s.id ? (
                      <>
                        <input
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #fecaca", fontSize: 12, width: 120 }}
                          placeholder={`พิมพ์ "${s.studentId}"`}
                          value={confirmText}
                          onChange={e => setConfirmText(e.target.value)}
                        />
                        <button style={dangerBtn} onClick={() => handlePermanentDelete(s)}>ยืนยันลบถาวร</button>
                        <button style={ghostBtn} onClick={() => { setConfirmId(null); setConfirmText(""); }}>ยกเลิก</button>
                      </>
                    ) : (
                      <button style={dangerBtn} onClick={() => setConfirmId(s.id)}>ลบถาวร</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb" };
const th: React.CSSProperties = { textAlign: "left", paddingBottom: 8, fontSize: 14, padding: "12px 10px", color: "#475569" };
const td: React.CSSProperties = { padding: "12px 10px", fontSize: 14, color: "#1e293b" };
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", border: "1px solid rgba(10,132,255,.25)", height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 13 };
const dangerBtn: React.CSSProperties = { background: "#fff", color: "#dc2626", border: "1px solid #fecaca", height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 13, fontWeight: 700 };
