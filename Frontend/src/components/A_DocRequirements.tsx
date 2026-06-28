import React, { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import axios from "axios";

type DocReq = {
    id: number;
    docKey: string;
    title: string;
    description: string;
    isRequired: boolean;
    isActive: boolean;
};

export default function A_DocRequirements() {
    const [reqs, setReqs] = useState<DocReq[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState<Partial<DocReq>>({});

    const fetchReqs = async () => {
        try {
            const res = await axios.get("/api/admin/doc-requirements");
            if (res.data.ok) setReqs(res.data.requirements);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchReqs(); }, []);

    const openAddModal = () => {
        setForm({ isRequired: true, isActive: true }); // ค่าเริ่มต้น
        setModalOpen(true);
    };

    const openEditModal = (r: DocReq) => {
        setForm(r);
        setModalOpen(true);
    };

    const saveRequirement = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem("coop.token");
        try {
            if (form.id) {
                await axios.put(`/api/admin/doc-requirements/${form.id}`, form, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post("/api/admin/doc-requirements", form, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            alert("บันทึกข้อมูลเรียบร้อย");
            setModalOpen(false);
            fetchReqs();
        } catch (err: any) {
            alert(err.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก");
        }
    };

    const removeRequirement = async (id: number, title: string) => {
        if (!confirm(`⚠️ ยืนยันการลบหัวข้อเอกสาร "${title}"?\n(ไฟล์ที่นักศึกษาเคยอัปโหลดในหัวข้อนี้จะยังอยู่ในระบบ แต่จะไม่แสดงในหน้าจออัปโหลดอีก)`)) return;
        const token = localStorage.getItem("coop.token");
        try {
            await axios.delete(`/api/admin/doc-requirements/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchReqs();
        } catch (err) {
            alert("ลบไม่สำเร็จ");
        }
    };

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER */}
            <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📑 จัดการหัวข้อเอกสารประกอบการสมัคร</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>กำหนดรายการเอกสารที่นักศึกษาต้องอัปโหลด (เช่น T000, Resume)</div>
                </div>
                <button className="btn" style={{ padding: '10px 20px', fontSize: 15 }} onClick={openAddModal}>
                    + เพิ่มหัวข้อเอกสารใหม่
                </button>
            </section>

            {/* TABLE */}
            <section style={card}>
                <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>รหัส (docKey)</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>ชื่อเอกสารที่แสดง</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>เงื่อนไข</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>สถานะ</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reqs.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>ยังไม่ได้กำหนดหัวข้อเอกสาร</td></tr>
                        ) : reqs.map(r => (
                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '14px 16px', fontSize: 14 }} data-label="รหัส (docKey)">
                                    <code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, color: '#0369a1', fontWeight: 700 }}>{r.docKey}</code>
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 14 }} data-label="ชื่อเอกสารที่แสดง">
                                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{r.title}</div>
                                    {r.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{r.description}</div>}
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 13 }} data-label="เงื่อนไข">
                                    {r.isRequired ? <span style={{ color: '#ef4444', fontWeight: 700 }}>* บังคับส่ง</span> : <span style={{ color: '#64748b' }}>ทางเลือก</span>}
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 13 }} data-label="สถานะ">
                                    {r.isActive ? <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>🟢 เปิดใช้งาน</span>
                                        : <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>⚫ ปิด</span>}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                    <button className="btn-ghost" style={{ marginRight: 8, padding: '6px 12px' }} onClick={() => openEditModal(r)}>✏️ แก้ไข</button>
                                    <button className="btn-danger" style={{ padding: '6px 12px' }} onClick={() => removeRequirement(r.id, r.title)}>🗑️ ลบ</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {/* MODAL */}
            {modalOpen && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <h3 style={{ marginTop: 0, marginBottom: 20, color: '#0f172a', fontSize: 20 }}>
                            {form.id ? "✏️ แก้ไขหัวข้อเอกสาร" : "✨ เพิ่มหัวข้อเอกสารใหม่"}
                        </h3>
                        <form onSubmit={saveRequirement} style={{ display: 'grid', gap: 16 }}>

                            <div>
                                <label style={label}>รหัสอ้างอิงเอกสาร (docKey) <span style={{ color: 'red' }}>*</span></label>
                                <input required className="input" placeholder="เช่น CP-T000, CP-CV (ห้ามซ้ำ)"
                                    value={form.docKey || ""} onChange={e => setForm({ ...form, docKey: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                                    disabled={!!form.id} // ถ้าแก้ไข ห้ามแก้รหัส
                                />
                                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>* ใช้ภาษาอังกฤษ ตัวพิมพ์ใหญ่ ติดกัน (แก้ไขไม่ได้ในภายหลัง)</div>
                            </div>

                            <div>
                                <label style={label}>ชื่อเอกสารที่จะแสดงให้นักศึกษาเห็น <span style={{ color: 'red' }}>*</span></label>
                                <input required className="input" placeholder="เช่น ใบสมัครงานสหกิจศึกษา (T000)"
                                    value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label style={label}>คำอธิบายเพิ่มเติม (ถ้ามี)</label>
                                <input className="input" placeholder="เช่น กรุณาติดรูปถ่ายและเซ็นชื่อให้เรียบร้อย"
                                    value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 24, marginTop: 8, background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                    <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.isRequired} onChange={e => setForm({ ...form, isRequired: e.target.checked })} />
                                    บังคับอัปโหลด (Required)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                    <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                                    เปิดใช้งานให้นักศึกษาเห็น
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>ยกเลิก</button>
                                <button type="submit" className="btn">💾 บันทึกหัวข้อเอกสาร</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CSS */}
            <style>{`
        .input { padding: 12px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box; }
        .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); }
      `}</style>
        </div>
    );
}

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const label: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContent: CSSProperties = { background: "#fff", borderRadius: 20, padding: 32, width: 500, maxWidth: "90%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };