import React, { useState, useEffect } from "react";
import axios from "axios";
import type { CSSProperties } from "react";

// --- Type สำหรับ CoopPeriod ---
type CoopPeriod = {
    id: number;
    academicYear: string;
    semester: number;
    startDate: string;
    endDate: string;
    isActive: boolean;
};

export default function A_CoopPeriod() {
    const [periods, setPeriods] = useState<CoopPeriod[]>([]);
    const [modalOpen, setModalOpen] = useState(false);

    // Form State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [academicYear, setAcademicYear] = useState(new Date().getFullYear() + 543 + "");
    const [semester, setSemester] = useState<number>(1);
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

    /* ================= LOAD DATA ================= */
    const fetchPeriods = async () => {
        try {
            // 💡 อย่าลืมไปสร้าง API เส้นนี้ใน Backend นะครับ
            const res = await axios.get("http://localhost:5000/api/admin/coop-periods");
            if (res.data.ok) {
                setPeriods(res.data.periods);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { fetchPeriods(); }, []);

    /* ================= ACTIONS ================= */
    const openAddModal = () => {
        setEditingId(null);
        setAcademicYear(new Date().getFullYear() + 543 + "");
        setSemester(1);
        setStartDate(new Date().toISOString().slice(0, 10));
        setEndDate(new Date().toISOString().slice(0, 10));
        setModalOpen(true);
    };

    const openEditModal = (p: CoopPeriod) => {
        setEditingId(p.id);
        setAcademicYear(p.academicYear);
        setSemester(p.semester);
        setStartDate(new Date(p.startDate).toISOString().slice(0, 10));
        setEndDate(new Date(p.endDate).toISOString().slice(0, 10));
        setModalOpen(true);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!academicYear.trim()) return alert("กรุณากรอกปีการศึกษา");

        const payload = {
            academicYear,
            semester: Number(semester),
            startDate,
            endDate
        };

        try {
            if (editingId) {
                await axios.put(`http://localhost:5000/api/admin/coop-periods/${editingId}`, payload);
            } else {
                await axios.post("http://localhost:5000/api/admin/coop-periods", payload);
            }
            setModalOpen(false);
            fetchPeriods();
        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการบันทึก (อาจมีปี/เทอมนี้ซ้ำอยู่แล้ว)");
        }
    };

    const toggleStatus = async (id: number, currentStatus: boolean) => {
        // หากปัจจุบันปิดอยู่ (กำลังจะกดเปิด)
        if (!currentStatus) {
            const hasActive = periods.some(p => p.isActive && p.id !== id);
            if (hasActive) {
                if (!confirm(`⚠️ มีรอบรับสมัครอื่นเปิดอยู่แล้ว\nคุณต้องการ "ปิดรอบเดิม" และ "เปิดรอบนี้" แทนหรือไม่?`)) return;
            } else {
                if (!confirm(`ต้องการเปิดการรับสมัครรอบนี้ใช่หรือไม่?`)) return;
            }
        } else {
            // หากปัจจุบันเปิดอยู่ (กำลังจะกดปิด)
            if (!confirm(`ต้องการปิดการรับสมัครรอบนี้ใช่หรือไม่?`)) return;
        }

        try {
            await axios.patch(`http://localhost:5000/api/admin/coop-periods/${id}/toggle`, {
                isActive: !currentStatus
            });
            fetchPeriods();
        } catch (err) {
            console.error(err);
            alert("ไม่สามารถเปลี่ยนสถานะได้");
        }
    };

    const remove = async (id: number) => {
        if (!confirm("ลบรอบการรับสมัครนี้? (คำเตือน: หากมีนักศึกษาอยู่ในรอบนี้อาจเกิดปัญหา)")) return;
        try {
            await axios.delete(`http://localhost:5000/api/admin/coop-periods/${id}`);
            fetchPeriods();
        } catch (err) {
            console.error(err);
            alert("ลบไม่สำเร็จ");
        }
    };

    /* ================= RENDER ================= */
    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER SECTION */}
            <section style={{ ...card, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📅 จัดการรอบรับสมัครสหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>กำหนดวันเปิด-ปิด ระบบรับสมัครแยกตามปีการศึกษาและภาคเรียน</div>
                </div>
                <button className="btn" onClick={openAddModal} style={{ padding: '10px 20px' }}>
                    + สร้างรอบใหม่
                </button>
            </section>

            {/* LIST SECTION */}
            <section style={card}>
                <h3 style={sectionTitle}>รายการรอบที่เปิดรับ</h3>

                {periods.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>ยังไม่มีข้อมูลรอบรับสมัคร</div>
                ) : (
                    <div style={{ display: 'grid', gap: 16 }}>
                        {periods.map(p => {
                            const start = new Date(p.startDate).toLocaleDateString('th-TH');
                            const end = new Date(p.endDate).toLocaleDateString('th-TH');

                            return (
                                <div key={p.id} style={listItem}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>
                                                ปีการศึกษา {p.academicYear} เทอม {p.semester}
                                            </div>
                                            <span style={p.isActive ? badgeActive : badgeInactive}>
                                                {p.isActive ? '🟢 เปิดรับสมัคร' : '⚫ ปิดรับสมัคร'}
                                            </span>
                                        </div>
                                        <div style={meta}>
                                            ระยะเวลา: <strong style={{ color: '#334155' }}>{start}</strong> ถึง <strong style={{ color: '#334155' }}>{end}</strong>
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", gap: 8, alignItems: 'center' }}>
                                        <button
                                            className="btn"
                                            style={p.isActive ? ghostBtnDanger : ghostBtnSuccess}
                                            onClick={() => toggleStatus(p.id, p.isActive)}
                                        >
                                            {p.isActive ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}
                                        </button>
                                        <button className="btn" style={ghostBtn} onClick={() => openEditModal(p)}>แก้ไข</button>
                                        <button className="btn" style={delBtn} onClick={() => remove(p.id)}>ลบ</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* MODAL */}
            {modalOpen && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <h3 style={{ marginTop: 0, color: '#1e293b' }}>
                            {editingId ? "✏️ แก้ไขรอบรับสมัคร" : "✨ สร้างรอบรับสมัครใหม่"}
                        </h3>

                        <form onSubmit={save} style={formGrid}>
                            <div style={{ display: 'flex', gap: 16 }}>
                                <div style={field}>
                                    <label style={label}>ปีการศึกษา (เช่น 2569)</label>
                                    <input className="input" required value={academicYear} onChange={e => setAcademicYear(e.target.value)} />
                                </div>
                                <div style={field}>
                                    <label style={label}>ภาคเรียน</label>
                                    <select className="input" value={semester} onChange={e => setSemester(Number(e.target.value))}>
                                        <option value={1}>เทอม 1</option>
                                        <option value={2}>เทอม 2</option>
                                        <option value={3}>เทอม 3 (ฤดูร้อน)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 16 }}>
                                <div style={field}>
                                    <label style={label}>วันที่เปิดรับสมัคร</label>
                                    <input type="date" required className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                </div>
                                <div style={field}>
                                    <label style={label}>วันที่ปิดรับสมัคร</label>
                                    <input type="date" required className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn" style={ghostBtn} onClick={() => setModalOpen(false)}>ยกเลิก</button>
                                <button className="btn" type="submit">บันทึกข้อมูล</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CSS Styles แบบเดียวกับ Settings */}
            <style>{`
        .btn { padding: 10px 16px; border-radius: 8px; border: none; font-weight: 600; font-size: 14px; transition: 0.2s; color: white; background: #0074B7; cursor: pointer; }
        .btn:hover { opacity: 0.9; }
        .input { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; }
        .input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,.2); }
      `}</style>
        </div>
    );
}

/* ================= STYLES ================= */
const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 30, border: "1px solid #f1f5f9", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" };
const sectionTitle: CSSProperties = { margin: "0 0 20px 0", fontSize: 18, fontWeight: 700, color: "#334155" };
const formGrid: CSSProperties = { display: "grid", gap: 16 };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, flex: 1 };
const label: CSSProperties = { fontSize: 13, fontWeight: 600, color: '#475569' };

const listItem: CSSProperties = { display: "flex", justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 20, border: "1px solid #e2e8f0", borderRadius: 12, background: '#f8fafc' };
const meta: CSSProperties = { fontSize: 14, color: "#64748b", marginTop: 8 };

// Badges
const badgeActive: CSSProperties = { background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: '1px solid #bbf7d0' };
const badgeInactive: CSSProperties = { background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: '1px solid #e2e8f0' };

// Buttons
const ghostBtn: CSSProperties = { background: "#fff", color: "#3b82f6", boxShadow: "none", border: "1px solid rgba(59,130,246,.3)", height: 38 };
const ghostBtnSuccess: CSSProperties = { background: "#fff", color: "#16a34a", boxShadow: "none", border: "1px solid rgba(22,163,74,.3)", height: 38 };
const ghostBtnDanger: CSSProperties = { background: "#fff", color: "#dc2626", boxShadow: "none", border: "1px solid rgba(220,38,38,.3)", height: 38 };
const delBtn: CSSProperties = { background: "#fff", color: "#dc2626", boxShadow: "none", border: "1px solid rgba(220,38,38,.3)", height: 38, cursor: "pointer" };

// Modal
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, backdropFilter: 'blur(2px)' };
const modalContent: CSSProperties = { background: "#fff", borderRadius: 16, padding: 28, width: 600, maxWidth: "90%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" };