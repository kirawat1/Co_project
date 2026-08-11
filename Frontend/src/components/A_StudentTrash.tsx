import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import type { StudentProfile } from "./A_Students";

export default function A_StudentTrash() {
  const [items, setItems] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/students/trash");
      if (!res.ok) return;
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
      const res = await apiFetch(`/api/admin/students/${s.id}/restore`, {
        method: "POST",
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

  if (loading) return <div style={{ padding: 20 }}>กำลังโหลด...</div>;

  return (
    <section style={card}>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>ถังขยะ</h2>
      {items.length === 0 ? (
        <div style={{ color: "#64748b", padding: 20, textAlign: "center" }}>ถังขยะว่าง</div>
      ) : (
        <table width="100%" className="responsive-table" style={{ borderCollapse: "collapse" }}>
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
                <td style={td} data-label="รหัส">{s.studentId}</td>
                <td style={td} data-label="ชื่อ–นามสกุล">{s.firstName} {s.lastName}</td>
                <td style={td} data-label="อีเมล">{s.user?.email || "-"}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button style={ghostBtn} onClick={() => handleRestore(s)}>กู้คืน</button>
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
