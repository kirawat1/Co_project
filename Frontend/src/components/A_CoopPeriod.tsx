import React, { useState, useEffect } from "react";
import axios from "axios";
import type { CSSProperties } from "react";
import { fmtDate } from '../utils/dateFormat';
import DateInput from './DateInput';
import { notify, askConfirm } from "../utils/notify";
import Modal from "./Modal";

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
            const res = await axios.get("/api/admin/coop-periods");
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
        if (!academicYear.trim()) return notify.warning("กรุณากรอกปีการศึกษา");

        const payload = {
            academicYear,
            semester: Number(semester),
            startDate,
            endDate
        };

        const token = localStorage.getItem("coop.token");
        try {
            if (editingId) {
                await axios.put(`/api/admin/coop-periods/${editingId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post("/api/admin/coop-periods", payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setModalOpen(false);
            fetchPeriods();
        } catch (err) {
            console.error(err);
            notify.error("เกิดข้อผิดพลาดในการบันทึก (อาจมีปี/เทอมนี้ซ้ำอยู่แล้ว)");
        }
    };

    const toggleStatus = async (id: number, currentStatus: boolean) => {
        // หากปัจจุบันปิดอยู่ (กำลังจะกดเปิด)
        if (!currentStatus) {
            const hasActive = periods.some(p => p.isActive && p.id !== id);
            if (hasActive) {
                if (!(await askConfirm(`⚠️ มีรอบรับสมัครอื่นเปิดอยู่แล้ว\nคุณต้องการ "ปิดรอบเดิม" และ "เปิดรอบนี้" แทนหรือไม่?`, { title: "มีรอบที่เปิดอยู่แล้ว", confirmLabel: "ปิดรอบเดิม เปิดรอบนี้" }))) return;
            } else {
                if (!(await askConfirm(`ต้องการเปิดการรับสมัครรอบนี้ใช่หรือไม่?`, { confirmLabel: "เปิดรับสมัคร" }))) return;
            }
        } else {
            // หากปัจจุบันเปิดอยู่ (กำลังจะกดปิด)
            if (!(await askConfirm(`ต้องการปิดการรับสมัครรอบนี้ใช่หรือไม่?`, { confirmLabel: "ปิดรับสมัคร", danger: true, icon: "🔒" }))) return;
        }

        const token = localStorage.getItem("coop.token");
        try {
            await axios.patch(`/api/admin/coop-periods/${id}/toggle`, {
                isActive: !currentStatus
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPeriods();
        } catch (err: any) {
            console.error(err);
            // แสดงเหตุผลจาก server (เช่น เลยวันปิดรับสมัครแล้ว) แทนข้อความกลางๆ
            notify.error(err?.response?.data?.message || err?.response?.data?.error || "ไม่สามารถเปลี่ยนสถานะได้");
        }
    };

    const remove = async (id: number) => {
        if (!(await askConfirm("ลบรอบการรับสมัครนี้? (คำเตือน: หากมีนักศึกษาอยู่ในรอบนี้อาจเกิดปัญหา)", { confirmLabel: "ลบรอบ", danger: true }))) return;
        const token = localStorage.getItem("coop.token");
        try {
            await axios.delete(`/api/admin/coop-periods/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPeriods();
        } catch (err) {
            console.error(err);
            notify.error("ลบไม่สำเร็จ");
        }
    };

    /* ================= RENDER ================= */
    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER SECTION */}
            <section style={{ ...card, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📅 จัดการรอบรับสมัครสหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>กำหนดวันเปิด-ปิด ระบบรับสมัครแยกตามปีการศึกษาและภาคเรียน</div>
                </div>
                <button className="btn" onClick={openAddModal}>
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
                            const start = fmtDate(p.startDate);
                            const end = fmtDate(p.endDate);

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
                                            className={p.isActive ? "btn-danger" : "btn-success"}
                                            onClick={() => toggleStatus(p.id, p.isActive)}
                                        >
                                            {p.isActive ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}
                                        </button>
                                        <button className="btn-secondary" onClick={() => openEditModal(p)}>แก้ไข</button>
                                        <button className="btn-danger" onClick={() => remove(p.id)}>ลบ</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* MODAL */}
            {modalOpen && (
                <Modal title={editingId ? "✏️ แก้ไขรอบรับสมัคร" : "✨ สร้างรอบรับสมัครใหม่"} onClose={() => setModalOpen(false)}>
                    <form onSubmit={save} style={formGrid}>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
                                <DateInput required className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div style={field}>
                                <label style={label}>วันที่ปิดรับสมัคร</label>
                                <DateInput required className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>ยกเลิก</button>
                            <button className="btn" type="submit">บันทึกข้อมูล</button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* CSS Styles แบบเดียวกับ Settings */}
        </div>
    );
}

/* ================= STYLES ================= */
const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 30, border: "1px solid #f1f5f9", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" };
const sectionTitle: CSSProperties = { margin: "0 0 20px 0", fontSize: 18, fontWeight: 700, color: "#334155" };
const formGrid: CSSProperties = { display: "grid", gap: 16 };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, flex: 1 };
const label: CSSProperties = { fontSize: 13, fontWeight: 600, color: '#475569' };

const listItem: CSSProperties = { display: "flex", justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 20, border: "1px solid #e2e8f0", borderRadius: 12, background: '#f8fafc', flexWrap: 'wrap' };
const meta: CSSProperties = { fontSize: 14, color: "#64748b", marginTop: 8 };

// Badges
const badgeActive: CSSProperties = { background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: '1px solid #bbf7d0' };
const badgeInactive: CSSProperties = { background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: '1px solid #e2e8f0' };

