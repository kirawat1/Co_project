import React, { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import AutoTextarea from "./AutoTextarea";

// --- Types ---
type Document = { id: number; type: string; path: string; name: string; status: string; };
type Student = {
    id: number;
    studentId: string;
    firstName: string;
    lastName: string;
    docStatus: string;
    coopPeriodId?: number;
    coop: {
        coopPeriodId?: number; // เผื่อกรณี Backend ซ้อนมาใน coop
        company: { name: string; };
        status?: string;
    };
    documents: Document[];
};

// 🟢 Types สำหรับการเรียงลำดับ (Sorting)
type SortKey = 'studentId' | 'name' | 'company' | 'status';
type SortDirection = 'asc' | 'desc';

export default function T_T002Review() {
    const [students, setStudents] = useState<Student[]>([]);

    // ✅ State สำหรับค้นหาและตัวกรองปีการศึกษา
    const [coopPeriods, setCoopPeriods] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);

    // 🟢 State สำหรับการเรียงลำดับ (Sorting)
    const [sortKey, setSortKey] = useState<SortKey>('studentId');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("coop.token");

            // ดึงรอบปีการศึกษามาแสดงใน Dropdown
            const resPeriods = await fetch("/api/admin/coop-periods/all", { headers: { Authorization: `Bearer ${token}` } });
            if (resPeriods.ok) {
                const periodsData = await resPeriods.json();
                if (periodsData.ok && periodsData.periods) setCoopPeriods(periodsData.periods);
            }

            // ดึงเฉพาะเด็กในที่ปรึกษาตัวเอง
            const res = await axios.get("/api/admin/students", {
                headers: { Authorization: `Bearer ${token}` }
            });

            let allStudents = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.students || []);

            const t002Students = allStudents.filter((student: any) => {
                const hasT002Doc = student.documents?.some((doc: any) => doc.type === 'T002_FORM');
                const isStatusMatch = ['T002_SUBMITTED', 'T002_EDITS_REQUIRED', 'INTERNSHIP_STARTED'].includes(student.coop?.status || student.docStatus);
                return hasT002Doc || isStatusMatch;
            });

            setStudents(t002Students);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchStudents(); }, []);

    const reloadStudents = async (period: string) => {
        try {
            const token = localStorage.getItem("coop.token");
            const params = new URLSearchParams();
            if (period !== "all") params.set("coopPeriodId", period);
            const res = await axios.get(`/api/admin/students?${params}`, { headers: { Authorization: `Bearer ${token}` } });
            const allStudents: any[] = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.students || []);
            setStudents(allStudents.filter((s: any) => {
                const hasT002Doc = s.documents?.some((d: any) => d.type === 'T002_FORM');
                const isStatusMatch = ['T002_SUBMITTED', 'T002_EDITS_REQUIRED', 'INTERNSHIP_STARTED'].includes(s.coop?.status || s.docStatus);
                return hasT002Doc || isStatusMatch;
            }));
        } catch (err) { console.error(err); }
    };
    const initialPeriodMount = useRef(true);
    useEffect(() => {
        if (initialPeriodMount.current) { initialPeriodMount.current = false; return; }
        reloadStudents(selectedPeriod);
    }, [selectedPeriod]);

    const getT002Status = (student: Student) => {
        const t002Doc = student.documents?.find(d => d.type === "T002_FORM");
        const docStatus = t002Doc?.status || 'WAITING';
        const profileStatus = student.coop?.status || student.docStatus;

        if (profileStatus === 'INTERNSHIP_STARTED' || docStatus === 'APPROVED') return { label: "✅ ตรวจผ่านแล้ว", color: "#10b981", bg: "#dcfce7" };
        if (profileStatus === 'T002_EDITS_REQUIRED' || docStatus === 'EDITS_REQUIRED' || docStatus === 'REJECTED') return { label: "⚠️ ตีกลับให้แก้ไข", color: "#dc2626", bg: "#fee2e2" };
        return { label: "📄 รอการตรวจสอบ", color: "#0d9488", bg: "#ccfbf1" };
    };

    // 🟢 ฟังก์ชันสำหรับจัดการการคลิก Header เพื่อเรียงลำดับ
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    // ✅ กรองรายชื่อ (ค้นหา + ปีการศึกษา) และ เรียงลำดับ (Sort)
    const processedStudents = useMemo(() => {
        // 1. Filter
        let filtered = students.filter(s => {
            const matchSearch = `${s.studentId} ${s.firstName} ${s.lastName} ${s.coop?.company?.name || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
            return matchSearch;
        });

        // 2. Sort
        filtered.sort((a, b) => {
            let valA = '';
            let valB = '';

            switch (sortKey) {
                case 'studentId': valA = a.studentId || ''; valB = b.studentId || ''; break;
                case 'name': valA = `${a.firstName} ${a.lastName}`; valB = `${b.firstName} ${b.lastName}`; break;
                case 'company': valA = a.coop?.company?.name || ''; valB = b.coop?.company?.name || ''; break;
                case 'status': valA = getT002Status(a).label; valB = getT002Status(b).label; break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [students, searchTerm, sortKey, sortDirection]);

    const openReviewModal = (student: Student) => { setSelectedStudent(student); setComment(""); setModalOpen(true); };

    const getT002FileUrl = (docs: Document[]) => {
        const file = docs?.find(d => d.type === "T002_FORM");
        return file ? `/uploads/${file.path}` : null;
    };

    const submitReview = async (action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !comment.trim()) return alert("กรุณาระบุเหตุผลที่ตีกลับ");
        if (!confirm(`ยืนยันการ ${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'} เอกสาร T002?`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem("coop.token");
            // อนุมัติ T002 ไม่ต้องเปลี่ยน coop.status ไปข้างหน้า (ยังไม่มีสถานะ "T002_APPROVED")
            // ส่งสถานะปัจจุบันกลับไปเฉยๆ ป้องกันค่าเดิมถูกเขียนทับเป็น INTERNSHIP_STARTED (ย้อนสถานะ)
            const newStatus = action === 'APPROVE' ? (selectedStudent?.coop?.status || 'T002_SUBMITTED') : 'T002_EDITS_REQUIRED';

            await axios.put(`/api/teacher/documents/review-t002`, {
                studentId: selectedStudent?.id,
                status: newStatus,
                comment: action === 'REJECT' ? comment : null
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert(`บันทึกผลเรียบร้อย`);
            setModalOpen(false);
            fetchStudents();
        } catch (err) { alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล"); }
        finally { setLoading(false); }
    };

    // UI HELPER: แสดงลูกศรเรียงลำดับ
    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <span style={{ color: '#cbd5e1', marginLeft: 4 }}>↕</span>;
        return <span style={{ color: '#0ea5e9', marginLeft: 4 }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
            <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📝 ตรวจสอบ T002 </h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>รายชื่อนักศึกษาในความดูแลที่รอตรวจสอบแบบแจ้งรายละเอียดงาน</div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        className="input"
                        placeholder="🔍 ค้นหารหัส / ชื่อ / บริษัท..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                    />

                    <select className="input" style={{ width: 'auto', background: '#f8fafc', padding: '10px 14px' }} value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
                        <option value="all">📚 ทุกปีการศึกษา</option>
                        {coopPeriods.map(p => (
                            <option key={p.id} value={String(p.id)}>เทอม {p.semester} / {p.academicYear}</option>
                        ))}
                    </select>

                    <button className="btn-ghost" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={fetchStudents} disabled={loading}>
                        {loading ? '⏳' : '🔄'} รีเฟรช
                    </button>

                    <div style={{ background: '#ecfdf5', color: '#047857', padding: '10px 16px', borderRadius: 8, fontWeight: 700, border: '1px solid #a7f3d0' }}>
                        ทั้งหมด: {processedStudents.length} รายการ
                    </div>
                </div>
            </section>

            <section style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                            {/* 🟢 หัวตารางกด Sort ได้ */}
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('studentId')}>
                                รหัสนักศึกษา <SortIcon columnKey="studentId" />
                            </th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                                ชื่อ-นามสกุล <SortIcon columnKey="name" />
                            </th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('company')}>
                                สถานที่ฝึกงาน <SortIcon columnKey="company" />
                            </th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>
                                สถานะ <SortIcon columnKey="status" />
                            </th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedStudents.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>🎉 ไม่มีเอกสาร T002 ในระบบ</td></tr>
                        ) : processedStudents.map(s => {
                            const statusInfo = getT002Status(s);
                            return (
                                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0369a1' }}>{s.studentId}</td>
                                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>{s.firstName} {s.lastName}</td>
                                    <td style={{ padding: '14px 16px', color: '#475569' }}>{s.coop?.company?.name || "-"}</td>
                                    <td style={{ padding: '14px 16px', fontSize: 13 }}>
                                        <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: '6px 12px', borderRadius: 999, fontWeight: 700 }}>
                                            {statusInfo.label}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                        <button className="btn" style={{ padding: '8px 16px', fontSize: 13, background: statusInfo.label.includes('รอการตรวจสอบ') ? '#0ea5e9' : '#64748b' }} onClick={() => openReviewModal(s)}>🔍 ตรวจเอกสาร</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </section>

            {modalOpen && selectedStudent && (
                <div style={modalOverlay}>
                    <div style={modalContentLarge}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 15, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: 20 }}>🔍 ตรวจสอบ T002: {selectedStudent.firstName}</h3>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
                        </div>
                        <div style={{ display: 'flex', gap: 24, height: '70vh' }}>
                            <div style={{ flex: 1, background: '#525659', borderRadius: 8, overflow: 'hidden' }}>
                                {getT002FileUrl(selectedStudent.documents || []) ? (
                                    <iframe src={getT002FileUrl(selectedStudent.documents || []) as string} width="100%" height="100%" style={{ border: 'none' }} title="PDF Preview" />
                                ) : <div style={{ color: 'white', padding: 20, textAlign: 'center', marginTop: 50 }}>⚠️ ไม่พบไฟล์ T002</div>}
                            </div>
                            <div style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={label}>ข้อเสนอแนะ / เหตุผลที่ตีกลับ</label>
                                    <AutoTextarea className="input" rows={6} value={comment} onChange={(e) => setComment(e.target.value)} />
                                </div>
                                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button className="btn-ghost" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5', padding: 14 }} onClick={() => submitReview('REJECT')} disabled={loading}>❌ ตีกลับให้แก้ไข</button>
                                    <button className="btn" style={{ background: '#10b981', padding: 14 }} onClick={() => submitReview('APPROVE')} disabled={loading}>✅ อนุมัติเอกสาร T002</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style>{` .btn { border-radius: 8px; border: none; font-weight: 700; color: white; background: #0ea5e9; cursor: pointer; transition: 0.2s; } .btn:hover:not(:disabled){ opacity: 0.9; } .btn-ghost { border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; background: #fff; cursor: pointer; transition: 0.2s; } .btn-ghost:hover:not(:disabled){ background: #f1f5f9; } .input { padding: 12px 14px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; outline: none; font-family: inherit; } .input:focus{ border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); } `}</style>
        </div>
    );
}

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const label: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContentLarge: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, width: "95%", maxWidth: 1200, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };