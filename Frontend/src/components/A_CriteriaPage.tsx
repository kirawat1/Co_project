import React, { useState, useEffect } from "react";
import axios from "axios";
import type { CSSProperties } from "react";

type Criteria = {
    id: string;
    major: string;
    minGpa: number;
    minCoreGpa: number;
    minActivityUnit: number;
    requiredCourses: string[];
    coreCourses: string[];
};

export default function A_CriteriaPage() {
    const [criteriaList, setCriteriaList] = useState<Criteria[]>([]);

    // State สำหรับ Modal เพิ่มสาขา
    const [addMajorModalOpen, setAddMajorModalOpen] = useState(false);
    const [newMajorName, setNewMajorName] = useState("");

    // State สำหรับ Modal แก้ไขเกณฑ์
    const [editCriteriaModalOpen, setEditCriteriaModalOpen] = useState(false);
    const [editingMajor, setEditingMajor] = useState(""); // เก็บชื่อสาขาที่กำลังแก้
    const [minGpa, setMinGpa] = useState("2.00");
    const [minCoreGpa, setMinCoreGpa] = useState("2.00");
    const [minActivityUnit, setMinActivityUnit] = useState("0");
    const [reqCourses, setReqCourses] = useState("");
    const [coreCourses, setCoreCourses] = useState("");

    const fetchCriteria = async () => {
        try {
            const res = await axios.get("http://localhost:5000/api/admin/criteria");
            if (res.data.ok) setCriteriaList(res.data.criteria);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchCriteria(); }, []);

    // ==========================================
    // 1. จัดการสาขา (เพิ่ม / ลบ)
    // ==========================================
    const handleAddMajor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMajorName.trim()) return alert("กรุณากรอกชื่อสาขา");

        // เช็คซ้ำในฝั่ง Frontend เบื้องต้น
        if (criteriaList.some(c => c.major.toLowerCase() === newMajorName.trim().toLowerCase())) {
            return alert("สาขานี้มีอยู่ในระบบแล้ว!");
        }

        try {
            // ส่งค่า Default เบื้องต้นไปสร้างสาขาใหม่
            await axios.post("http://localhost:5000/api/admin/criteria", {
                major: newMajorName.trim().toUpperCase(), // แนะนำให้เก็บเป็นตัวพิมพ์ใหญ่ (เช่น CS, IT)
                minGpa: 2.00,
                minCoreGpa: 2.00,
                minActivityUnit: 0,
                requiredCourses: [],
                coreCourses: []
            });
            setAddMajorModalOpen(false);
            setNewMajorName("");
            fetchCriteria();
        } catch (err: any) { alert(err.response?.data?.error || "เกิดข้อผิดพลาดในการเพิ่มสาขา"); }
    };

    const handleRemoveMajor = async (id: string, majorName: string) => {
        if (!confirm(`⚠️ ยืนยันการลบสาขา ${majorName} และเกณฑ์ทั้งหมดของสาขานี้?`)) return;
        try {
            await axios.delete(`http://localhost:5000/api/admin/criteria/${id}`);
            fetchCriteria();
        } catch (err) { alert("ลบไม่สำเร็จ"); }
    };

    // ==========================================
    // 2. จัดการเกณฑ์ (แก้ไข)
    // ==========================================
    const openEditCriteriaModal = (c: Criteria) => {
        setEditingMajor(c.major);
        setMinGpa(c.minGpa.toString());
        setMinCoreGpa(c.minCoreGpa.toString());
        setMinActivityUnit(c.minActivityUnit.toString());
        setReqCourses(c.requiredCourses.join(", "));
        setCoreCourses(c.coreCourses.join(", "));
        setEditCriteriaModalOpen(true);
    };

    const handleSaveCriteria = async (e: React.FormEvent) => {
        e.preventDefault();

        const reqArr = reqCourses.split(",").map(s => s.trim()).filter(s => s);
        const coreArr = coreCourses.split(",").map(s => s.trim()).filter(s => s);

        try {
            // ใช้ API ตัวเดิม (Upsert) โดยอิงจาก major
            await axios.post("http://localhost:5000/api/admin/criteria", {
                major: editingMajor,
                minGpa: parseFloat(minGpa),
                minCoreGpa: parseFloat(minCoreGpa),
                minActivityUnit: parseInt(minActivityUnit),
                requiredCourses: reqArr,
                coreCourses: coreArr
            });
            setEditCriteriaModalOpen(false);
            fetchCriteria();
        } catch (err: any) { alert(err.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึกเกณฑ์"); }
    };

    // ==========================================
    // RENDER
    // ==========================================
    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER */}
            <section style={{ ...card, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>⚙️ จัดการเกณฑ์สหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>เพิ่มสาขาวิชา และกำหนดเงื่อนไขการออกสหกิจฯ แยกตามสาขา</div>
                </div>
                <button className="btn" onClick={() => setAddMajorModalOpen(true)}>+ เพิ่มสาขาวิชาใหม่</button>
            </section>

            {/* MAJOR CARDS GRID */}
            {criteriaList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#fff', borderRadius: 16 }}>
                    ยังไม่มีข้อมูลสาขาวิชา กรุณากดปุ่ม "+ เพิ่มสาขาวิชาใหม่"
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 24 }}>
                    {criteriaList.map(c => (
                        <div key={c.id} style={majorCard}>

                            {/* Card Header: แสดงชื่อสาขา และปุ่มลบ */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px dashed #e2e8f0', paddingBottom: 16, marginBottom: 16 }}>
                                <div>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: 1 }}>หลักสูตร / สาขาวิชา</span>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{c.major}</div>
                                </div>
                                <button style={delBtn} onClick={() => handleRemoveMajor(c.id, c.major)}>🗑️ ลบสาขา</button>
                            </div>

                            {/* Card Body: แสดงเกณฑ์ปัจจุบัน */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                                <div style={statBox}>
                                    <div style={statLabel}>GPA รวมขั้นต่ำ</div>
                                    <div style={statValue}>{c.minGpa.toFixed(2)}</div>
                                </div>
                                <div style={statBox}>
                                    <div style={statLabel}>GPA วิชาแกนขั้นต่ำ</div>
                                    <div style={statValue}>{c.minCoreGpa.toFixed(2)}</div>
                                </div>
                                <div style={{ ...statBox, gridColumn: 'span 2' }}>
                                    <div style={statLabel}>หน่วยกิตขั้นต่ำ </div>
                                    <div style={statValue}>{c.minActivityUnit} หน่วย</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: 12 }}>
                                <div style={statLabel}>📚 รายวิชาบังคับ (ต้องผ่านทุกตัว)</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                    {c.requiredCourses.length ? c.requiredCourses.map(rc => <span key={rc} style={badgeObj}>{rc}</span>) : <span style={emptyText}>ไม่มีกำหนด</span>}
                                </div>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <div style={statLabel}>🎯 หมวดวิชาบังคับเลือก (เลือกเรียนบางตัว)</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                    {c.coreCourses.length ? c.coreCourses.map(cc => <span key={cc} style={badgeCore}>{cc}</span>) : <span style={emptyText}>ไม่มีกำหนด</span>}
                                </div>
                            </div>

                            {/* Card Footer: ปุ่มแก้ไขเกณฑ์ */}
                            <button className="btn-outline" style={{ width: '100%' }} onClick={() => openEditCriteriaModal(c)}>
                                ⚙️ ตั้งค่าเกณฑ์ของสาขา {c.major}
                            </button>

                        </div>
                    ))}
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 1: เพิ่มสาขาใหม่ (แสดงแค่ช่องกรอกชื่อ) */}
            {/* ========================================================= */}
            {addMajorModalOpen && (
                <div style={modalOverlay}>
                    <div style={{ ...modalContent, width: 400 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 8, color: '#0f172a' }}>✨ เพิ่มสาขาวิชาใหม่</h3>
                        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>เมื่อเพิ่มสาขาแล้ว คุณจะสามารถตั้งค่าเกณฑ์ต่างๆ ได้ภายหลัง</p>

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

            {/* ========================================================= */}
            {/* MODAL 2: ตั้งค่าเกณฑ์ (ไม่ให้แก้ชื่อสาขา แก้ได้เฉพาะตัวเลข/วิชา) */}
            {/* ========================================================= */}
            {editCriteriaModalOpen && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <h3 style={{ marginTop: 0, marginBottom: 20, color: '#0f172a' }}>
                            ⚙️ ตั้งค่าเกณฑ์สำหรับสาขา <span style={{ color: '#0ea5e9' }}>{editingMajor}</span>
                        </h3>

                        <form onSubmit={handleSaveCriteria} style={{ display: 'grid', gap: 16 }}>

                            <div style={{ display: 'flex', gap: 16 }}>
                                <div style={field}><label style={label}>GPA รวมขั้นต่ำ</label><input required type="number" step="0.01" className="input" value={minGpa} onChange={e => setMinGpa(e.target.value)} /></div>
                                <div style={field}><label style={label}>GPA วิชาแกนขั้นต่ำ</label><input required type="number" step="0.01" className="input" value={minCoreGpa} onChange={e => setMinCoreGpa(e.target.value)} /></div>
                                <div style={field}><label style={label}>หน่วยกิตขั้นต่ำ</label><input required type="number" className="input" value={minActivityUnit} onChange={e => setMinActivityUnit(e.target.value)} /></div>
                            </div>

                            <div style={field}>
                                <label style={label}>รหัสวิชาบังคับ (ต้องผ่านทุกตัว)</label>
                                <input className="input" placeholder="เช่น CS101, CS102 (คั่นด้วยลูกน้ำ ,)" value={reqCourses} onChange={e => setReqCourses(e.target.value)} />
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>* คั่นแต่ละวิชาด้วยเครื่องหมายลูกน้ำ (,)</span>
                            </div>

                            <div style={field}>
                                <label style={label}>รหัสหมวดวิชาบังคับเลือก (เลือกเรียนบางตัว)</label>
                                <input className="input" placeholder="เช่น SC310001, SC310002" value={coreCourses} onChange={e => setCoreCourses(e.target.value)} />
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>* คั่นแต่ละวิชาด้วยเครื่องหมายลูกน้ำ (,)</span>
                            </div>

                            <div style={{ display: "flex", gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn-ghost" onClick={() => setEditCriteriaModalOpen(false)}>ยกเลิก</button>
                                <button type="submit" className="btn">💾 บันทึกการตั้งค่า</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CSS STYLES */}
            <style>{`
        .btn { padding: 10px 18px; border-radius: 8px; border: none; font-weight: 700; font-size: 14px; color: white; background: #0074B7; cursor: pointer; transition: 0.2s; }
        .btn:hover { background: #005f96; }
        .btn-outline { padding: 10px 16px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 14px; color: #475569; background: #fff; cursor: pointer; transition: 0.2s; }
        .btn-outline:hover { background: #f8fafc; border-color: #94a3b8; color: #0f172a; }
        .btn-ghost { padding: 10px 16px; border-radius: 8px; border: none; font-weight: 700; font-size: 14px; color: #64748b; background: #f1f5f9; cursor: pointer; transition: 0.2s; }
        .btn-ghost:hover { background: #e2e8f0; color: #334155; }
        
        .input { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; }
        .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); }
      `}</style>
        </div>
    );
}

/* UI Variables */
const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const majorCard: CSSProperties = { background: "#fff", borderRadius: 18, padding: 28, border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" };
const statBox: CSSProperties = { background: '#f8fafc', padding: '12px 16px', borderRadius: 10, border: '1px solid #f1f5f9' };
const statLabel: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#64748b' };
const statValue: CSSProperties = { fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 };

const badgeObj: CSSProperties = { background: '#e0f2fe', color: '#0369a1', fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid #bae6fd' };
const badgeCore: CSSProperties = { background: '#fdf4ff', color: '#a21caf', fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid #fbcfe8' };
const emptyText: CSSProperties = { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', background: '#f1f5f9', padding: '4px 10px', borderRadius: 6 };

const delBtn: CSSProperties = { background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8 };

const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContent: CSSProperties = { background: "#fff", borderRadius: 20, padding: 32, width: 650, maxWidth: "90%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, flex: 1 };
const label: CSSProperties = { fontSize: 14, fontWeight: 700, color: '#334155' };