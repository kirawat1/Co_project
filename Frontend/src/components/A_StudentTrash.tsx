import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import type { StudentProfile } from "./A_Students";
import LoadMoreFooter from "./LoadMoreFooter";
import { useLoadMore } from "../utils/useLoadMore";

export default function A_StudentTrash() {
  const [items, setItems] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  // ลบถาวรย้อนกลับไม่ได้ — ต้องพิมพ์รหัสนักศึกษาให้ตรงก่อนถึงกดยืนยันได้
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  const cancelConfirm = () => { setConfirmId(null); setConfirmText(""); };

  const handlePermanentDelete = async (s: StudentProfile) => {
    if (confirmText.trim() !== s.studentId) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/admin/students/${s.id}/permanent`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        alert(data.message || "ลบถาวรไม่สำเร็จ");
        return;
      }
      cancelConfirm();
      setItems(prev => prev.filter(x => x.id !== s.id));
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setDeleting(false);
    }
  };

  // แสดงทีละ 30 คน เลื่อนถึงท้ายตารางแล้วแสดงเพิ่ม แทนโหลดทั้งหมดในตารางเดียว
  const { shown: shownItems, hasMore, sentinelRef, showMore, total } = useLoadMore(items);

  if (loading) return <div style={{ padding: 20 }}>กำลังโหลด...</div>;

  return (
    <section style={card}>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>ถังขยะ</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>
        "ลบถาวร" ลบบัญชี ข้อมูลสหกิจ เอกสาร และไฟล์ที่อัปโหลดของนักศึกษาออกจากระบบ กู้คืนไม่ได้ (บริษัทที่นักศึกษาเคยเพิ่มยังอยู่)
      </p>
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
            {shownItems.map(s => (
              <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={td} data-label="รหัส">{s.studentId}</td>
                <td style={td} data-label="ชื่อ–นามสกุล">{s.firstName} {s.lastName}</td>
                <td style={td} data-label="อีเมล">{s.user?.email || "-"}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {confirmId === s.id ? (
                      <>
                        <input
                          autoFocus
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #fecaca", fontSize: 12, width: 150 }}
                          placeholder={`พิมพ์ ${s.studentId} เพื่อยืนยัน`}
                          aria-label={`พิมพ์รหัส ${s.studentId} เพื่อยืนยันลบถาวร`}
                          value={confirmText}
                          onChange={e => setConfirmText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handlePermanentDelete(s); if (e.key === "Escape") cancelConfirm(); }}
                        />
                        <button
                          style={{ ...dangerSolidBtn, opacity: confirmText.trim() === s.studentId && !deleting ? 1 : 0.5, cursor: confirmText.trim() === s.studentId && !deleting ? "pointer" : "not-allowed" }}
                          disabled={confirmText.trim() !== s.studentId || deleting}
                          onClick={() => handlePermanentDelete(s)}
                        >
                          {deleting ? "กำลังลบ..." : "ยืนยันลบถาวร"}
                        </button>
                        <button style={ghostBtn} onClick={cancelConfirm} disabled={deleting}>ยกเลิก</button>
                      </>
                    ) : (
                      <>
                        <button style={ghostBtn} onClick={() => handleRestore(s)}>กู้คืน</button>
                        <button style={dangerBtn} onClick={() => { setConfirmId(s.id); setConfirmText(""); }}>🗑️ ลบถาวร</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <LoadMoreFooter shownCount={shownItems.length} total={total} hasMore={hasMore} onShowMore={showMore} sentinelRef={sentinelRef} itemLabel="คน" />
    </section>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb" };
const th: React.CSSProperties = { textAlign: "left", paddingBottom: 8, fontSize: 14, padding: "12px 10px", color: "#475569" };
const td: React.CSSProperties = { padding: "12px 10px", fontSize: 14, color: "#1e293b" };
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", border: "1px solid rgba(10,132,255,.25)", height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 13 };
const dangerBtn: React.CSSProperties = { background: "#fff", color: "#dc2626", border: "1px solid #fecaca", height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 13, fontWeight: 700 };
const dangerSolidBtn: React.CSSProperties = { background: "#dc2626", color: "#fff", border: "1px solid #dc2626", height: 32, borderRadius: 8, padding: "0 12px", fontSize: 13, fontWeight: 700 };
