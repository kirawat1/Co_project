import React, { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import { notify, askConfirm } from "../utils/notify";
import { useAdminRole } from "./adminRole";
import { apiFetch } from "../utils/apiFetch";

type DocReq = {
    id: number;
    docKey: string;
    title: string;
    description: string;
    isRequired: boolean;
    isActive: boolean;
    majors: string[];          // ว่าง = ทุกหลักสูตร
    excludedMajors: string[];  // หลักสูตรที่ปิดหัวข้อกลางนี้
    canManage: boolean;        // แก้/ลบได้ (อาจารย์ประจำวิชา = เฉพาะหัวข้อของหลักสูตรตัวเอง)
};

export default function A_DocRequirements() {
    // เจ้าหน้าที่: ทุกหลักสูตร · อาจารย์ประจำวิชา: หัวข้อของหลักสูตรตัวเอง + เปิด/ปิดหัวข้อกลางสำหรับหลักสูตรตัวเอง
    const { isStaff, majors: myMajors } = useAdminRole();
    const [allMajors, setAllMajors] = useState<string[]>([]);
    const controllableMajors = isStaff ? allMajors : myMajors;

    const [reqs, setReqs] = useState<DocReq[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState<Partial<DocReq>>({});
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const fetchReqs = async () => {
        try {
            const res = await axios.get("/api/admin/doc-requirements");
            if (res.data.ok) setReqs(res.data.requirements);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchReqs();
        if (isStaff) {
            apiFetch("/api/admin/majors").then(r => (r.ok ? r.json() : null)).then(d => { if (d?.ok) setAllMajors(d.majors ?? []); }).catch(() => {});
        }
    }, [isStaff]);

    const openAddModal = () => {
        // อาจารย์ประจำวิชาสร้างได้เฉพาะหัวข้อของหลักสูตรตัวเอง — ติ๊กหลักสูตรตัวเองไว้ก่อน
        setForm({ isRequired: true, isActive: true, majors: isStaff ? [] : [...myMajors] });
        setModalOpen(true);
    };

    const openEditModal = (r: DocReq) => {
        setForm(r);
        setModalOpen(true);
    };

    const saveRequirement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isStaff && !(form.majors ?? []).length) { notify.warning("กรุณาเลือกหลักสูตรอย่างน้อย 1 หลักสูตร"); return; }
        const payload = {
            docKey: form.docKey, title: form.title, description: form.description,
            isRequired: form.isRequired, isActive: form.isActive, majors: form.majors ?? [],
        };
        try {
            if (form.id) await axios.put(`/api/admin/doc-requirements/${form.id}`, payload);
            else await axios.post("/api/admin/doc-requirements", payload);
            notify.success("บันทึกข้อมูลเรียบร้อย");
            setModalOpen(false);
            fetchReqs();
        } catch (err: any) {
            notify.error(err.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก");
        }
    };

    const removeRequirement = async (id: number, title: string) => {
        if (!(await askConfirm(`⚠️ ยืนยันการลบหัวข้อเอกสาร "${title}"?\n(ไฟล์ที่นักศึกษาเคยอัปโหลดในหัวข้อนี้จะยังอยู่ในระบบ แต่จะไม่แสดงในหน้าจออัปโหลดอีก)`, { confirmLabel: "ลบหัวข้อ", danger: true }))) return;
        try {
            await axios.delete(`/api/admin/doc-requirements/${id}`);
            fetchReqs();
        } catch (err: any) {
            notify.error(err.response?.data?.message || "ลบไม่สำเร็จ");
        }
    };

    // เปิด/ปิดหัวข้อกลางสำหรับหลักสูตรหนึ่ง
    const toggleShared = async (r: DocReq, major: string) => {
        const excluded = !r.excludedMajors.includes(major);
        setBusyKey(`${r.id}:${major}`);
        try {
            const res = await axios.put(`/api/admin/doc-requirements/${r.id}/exclusions`, { major, excluded });
            setReqs(prev => prev.map(x => (x.id === r.id ? { ...x, ...res.data.requirement, canManage: x.canManage } : x)));
        } catch (err: any) {
            notify.error(err.response?.data?.message || "บันทึกไม่สำเร็จ");
        } finally {
            setBusyKey(null);
        }
    };

    const setFormMajors = (majors: string[]) => setForm(f => ({ ...f, majors }));
    const formMajors = form.majors ?? [];
    const formShared = formMajors.length === 0;

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER */}
            <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📑 จัดการหัวข้อเอกสารประกอบการสมัคร</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
                        กำหนดรายการเอกสารที่นักศึกษาต้องอัปโหลด — หัวข้อ "ทุกหลักสูตร" ปิดใช้รายหลักสูตรได้ · เพิ่มหัวข้อเฉพาะหลักสูตรได้
                    </div>
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
                            <th style={th}>รหัส (docKey)</th>
                            <th style={th}>ชื่อเอกสารที่แสดง</th>
                            <th style={th}>ใช้กับหลักสูตร</th>
                            <th style={th}>เงื่อนไข</th>
                            <th style={th}>สถานะ</th>
                            <th style={{ ...th, textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reqs.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>ยังไม่ได้กำหนดหัวข้อเอกสาร</td></tr>
                        ) : reqs.map(r => (
                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={td} data-label="รหัส (docKey)">
                                    <code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, color: '#0369a1', fontWeight: 700 }}>{r.docKey}</code>
                                </td>
                                <td style={td} data-label="ชื่อเอกสารที่แสดง">
                                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{r.title}</div>
                                    {r.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{r.description}</div>}
                                </td>
                                <td style={td} data-label="ใช้กับหลักสูตร">
                                    {r.majors.length > 0 ? (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {r.majors.map(m => <span key={m} style={majorBadge}>เฉพาะ {m}</span>)}
                                        </div>
                                    ) : (
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>ทุกหลักสูตร</div>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {controllableMajors.map(m => {
                                                    const off = r.excludedMajors.includes(m);
                                                    return (
                                                        <button
                                                            key={m}
                                                            type="button"
                                                            disabled={busyKey === `${r.id}:${m}`}
                                                            onClick={() => toggleShared(r, m)}
                                                            title={off ? `หลักสูตร ${m} ไม่ใช้หัวข้อนี้ — กดเพื่อเปิดใช้` : `หลักสูตร ${m} ใช้หัวข้อนี้ — กดเพื่อปิดสำหรับ ${m}`}
                                                            style={{ ...chip, background: off ? '#f1f5f9' : '#ecfdf5', color: off ? '#94a3b8' : '#047857', borderColor: off ? '#e2e8f0' : '#a7f3d0', textDecoration: off ? 'line-through' : 'none' }}
                                                        >
                                                            {off ? '✕' : '✓'} {m}
                                                        </button>
                                                    );
                                                })}
                                                {/* หลักสูตรที่ปิดไว้แต่ผู้ใช้ไม่ได้ดูแล — แสดงให้รู้เฉยๆ */}
                                                {r.excludedMajors.filter(m => !controllableMajors.includes(m)).map(m => (
                                                    <span key={m} style={{ ...chip, cursor: 'default', background: '#f8fafc', color: '#94a3b8', textDecoration: 'line-through' }}>✕ {m}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </td>
                                <td style={{ ...td, fontSize: 13 }} data-label="เงื่อนไข">
                                    {r.isRequired ? <span style={{ color: '#ef4444', fontWeight: 700 }}>* บังคับส่ง</span> : <span style={{ color: '#64748b' }}>ทางเลือก</span>}
                                </td>
                                <td style={{ ...td, fontSize: 13 }} data-label="สถานะ">
                                    {r.isActive ? <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>🟢 เปิดใช้งาน</span>
                                        : <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>⚫ ปิด</span>}
                                </td>
                                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {r.canManage ? (
                                        <>
                                            <button className="btn-ghost" style={{ marginRight: 8, padding: '6px 12px' }} onClick={() => openEditModal(r)}>✏️ แก้ไข</button>
                                            <button className="btn-danger" style={{ padding: '6px 12px' }} onClick={() => removeRequirement(r.id, r.title)}>🗑️ ลบ</button>
                                        </>
                                    ) : (
                                        <span style={{ fontSize: 12, color: '#94a3b8' }}>หัวข้อกลาง (เจ้าหน้าที่แก้ไข)</span>
                                    )}
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

                            {/* ใช้กับหลักสูตร */}
                            <div>
                                <label style={label}>ใช้กับหลักสูตร</label>
                                {isStaff && (
                                    <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 14 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                            <input type="radio" checked={formShared} onChange={() => setFormMajors([])} /> ทุกหลักสูตร
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: allMajors.length ? 'pointer' : 'not-allowed' }}>
                                            <input type="radio" checked={!formShared} disabled={!allMajors.length} onChange={() => setFormMajors(allMajors.slice(0, 1))} /> เฉพาะหลักสูตร
                                        </label>
                                    </div>
                                )}
                                {(!isStaff || !formShared) && (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {controllableMajors.map(m => {
                                            const checked = formMajors.includes(m);
                                            return (
                                                <label key={m} style={{ ...chip, cursor: 'pointer', background: checked ? '#eff6ff' : '#fff', color: checked ? '#1d4ed8' : '#334155', borderColor: checked ? '#3b82f6' : '#cbd5e1' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => {
                                                            const next = checked ? formMajors.filter(x => x !== m) : [...formMajors, m];
                                                            if (next.length === 0) return; // ต้องมีอย่างน้อย 1 (เจ้าหน้าที่เลือก "ทุกหลักสูตร" แทน)
                                                            setFormMajors(next);
                                                        }}
                                                        style={{ accentColor: '#2563eb' }}
                                                    />
                                                    {m}
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                                {!isStaff && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>หัวข้อทุกหลักสูตรเป็นของเจ้าหน้าที่ — ปิดใช้สำหรับหลักสูตรของคุณได้ที่ตาราง</div>}
                                {form.id && isStaff && !formShared && (form.excludedMajors ?? []).length > 0 && (
                                    <div style={{ fontSize: 12, color: '#b45309', marginTop: 6 }}>⚠️ เปลี่ยนเป็นหัวข้อเฉพาะหลักสูตร — การปิดรายหลักสูตรเดิม ({form.excludedMajors!.join(", ")}) จะถูกล้าง</div>
                                )}
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
        </div>
    );
}

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const th: CSSProperties = { padding: '14px 16px', color: '#64748b', fontSize: 13 };
const td: CSSProperties = { padding: '14px 16px', fontSize: 14 };
const label: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff' };
const majorBadge: CSSProperties = { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContent: CSSProperties = { background: "#fff", padding: 32, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
