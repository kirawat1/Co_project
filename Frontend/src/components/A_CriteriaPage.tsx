import React, { useState, useEffect } from "react";
import axios from "axios";
import type { CSSProperties } from "react";

type Criteria = {
    id: string;
    major: string;
};

export default function A_CriteriaPage() {
    const [criteriaList, setCriteriaList] = useState<Criteria[]>([]);
    const [addMajorModalOpen, setAddMajorModalOpen] = useState(false);
    const [newMajorName, setNewMajorName] = useState("");

    const fetchCriteria = async () => {
        try {
            const res = await axios.get("/api/admin/criteria");
            if (res.data.ok) setCriteriaList(res.data.criteria);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchCriteria(); }, []);

    const handleAddMajor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMajorName.trim()) return alert("กรุณากรอกชื่อสาขา");

        if (criteriaList.some(c => c.major.toLowerCase() === newMajorName.trim().toLowerCase())) {
            return alert("สาขานี้มีอยู่ในระบบแล้ว!");
        }

        const token = localStorage.getItem("coop.token");
        try {
            await axios.post("/api/admin/criteria", {
                major: newMajorName.trim().toUpperCase(), // แนะนำให้เก็บเป็นตัวพิมพ์ใหญ่ (เช่น CS, IT)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAddMajorModalOpen(false);
            setNewMajorName("");
            fetchCriteria();
        } catch (err: any) { alert(err.response?.data?.message || "เกิดข้อผิดพลาดในการเพิ่มสาขา"); }
    };

    const handleRemoveMajor = async (id: string, majorName: string) => {
        if (!confirm(`⚠️ ยืนยันการลบสาขา ${majorName}?`)) return;
        const token = localStorage.getItem("coop.token");
        try {
            await axios.delete(`/api/admin/criteria/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCriteria();
        } catch (err) { alert("ลบไม่สำเร็จ"); }
    };

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER */}
            <section style={{ ...card, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>⚙️ จัดการสาขาวิชาสหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>รายชื่อสาขาวิชาที่นักศึกษาสามารถยื่นสมัครสหกิจศึกษาได้</div>
                </div>
                <button className="btn" onClick={() => setAddMajorModalOpen(true)}>+ เพิ่มสาขาวิชาใหม่</button>
            </section>

            {/* MAJOR LIST */}
            {criteriaList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#fff', borderRadius: 16 }}>
                    ยังไม่มีข้อมูลสาขาวิชา กรุณากดปุ่ม "+ เพิ่มสาขาวิชาใหม่"
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
                    {criteriaList.map(c => (
                        <div key={c.id} style={majorCard}>
                            <div>
                                <span style={{ fontSize: 12, fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: 1 }}>สาขาวิชา</span>
                                <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{c.major}</div>
                            </div>
                            <button style={delBtn} onClick={() => handleRemoveMajor(c.id, c.major)}>🗑️ ลบสาขา</button>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL: เพิ่มสาขาใหม่ */}
            {addMajorModalOpen && (
                <div style={modalOverlay}>
                    <div style={{ ...modalContent, width: 400 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 8, color: '#0f172a' }}>✨ เพิ่มสาขาวิชาใหม่</h3>

                        <form onSubmit={handleAddMajor}>
                            <div style={field}>
                                <label style={label}>ตัวย่อสาขาวิชา (เช่น CS, IT, AI, GIS)</label>
                                <input
                                    required
                                    autoFocus
                                    className="input"
                                    value={newMajorName}
                                    onChange={e => setNewMajorName(e.target.value)}
                                    placeholder="กรอกชื่อย่อสาขา..."
                                />
                            </div>

                            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setAddMajorModalOpen(false)}>ยกเลิก</button>
                                <button type="submit" className="btn" style={{ flex: 1 }}>เพิ่มสาขา</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CSS STYLES */}
            <style>{`
        .input { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; }
        .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); }
      `}</style>
        </div>
    );
}

/* UI Variables */
const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const majorCard: CSSProperties = { background: "#fff", borderRadius: 18, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)", display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const delBtn: CSSProperties = { background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8 };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContent: CSSProperties = { background: "#fff", borderRadius: 20, padding: 32, width: 650, maxWidth: "90%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, flex: 1 };
const label: CSSProperties = { fontSize: 14, fontWeight: 700, color: '#334155' };
