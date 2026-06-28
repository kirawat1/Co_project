import React, { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import AutoTextarea from "./AutoTextarea";

// --- Types ---
type Document = {
    id: number;
    type: string;
    path: string;
    name: string;
    status: string;
};

type Student = {
    id: number;
    studentId: string;
    firstName: string;
    lastName: string;
    docStatus: string;
    coopPeriodId?: number; // ✅
    coop?: {
        coopPeriodId?: number; // ✅ เผื่อกรณีซ้อนอยู่ในนี้
        company?: {
            name: string;
        }
        status?: string;
    };
    documents: Document[];
};

// 🟢 Types สำหรับการเรียงลำดับ (Sorting)
type SortKey = 'studentId' | 'name' | 'company' | 'status';
type SortDirection = 'asc' | 'desc';

export default function A_T002Review() {
    const [students, setStudents] = useState<Student[]>([]);

    // ✅ State สำหรับเก็บรอบปีการศึกษาและคำค้นหา
    const [coopPeriods, setCoopPeriods] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);

    // 🟢 State จัดการการเปิด/ปิดระบบ
    const [config, setConfig] = useState({ startDate: "", endDate: "", isOpen: false });

    // 🟢 State สำหรับการเรียงลำดับ (Sorting)
    const [sortKey, setSortKey] = useState<SortKey>('studentId');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // เช็คสถานะอิงจากเวลาปัจจุบัน
    const isSystemOpen = useMemo(() => {
        const now = new Date().getTime();
        const start = config.startDate ? new Date(config.startDate).getTime() : 0;
        const end = config.endDate ? new Date(config.endDate).getTime() : 0;
        return config.isOpen && ((!start && !end) || (now >= start && now <= end));
    }, [config]);

    // 1. ดึงข้อมูลทั้งหมด
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("coop.token");

            const resPeriods = await fetch("/api/admin/coop-periods/all", { headers: { Authorization: `Bearer ${token}` } });
            if (resPeriods.ok) {
                const periodsData = await resPeriods.json();
                if (periodsData.ok && periodsData.periods) setCoopPeriods(periodsData.periods);
            }

            const res = await axios.get("/api/admin/students", {
                headers: { Authorization: `Bearer ${token}` }
            });

            let allStudents = [];
            if (Array.isArray(res.data)) {
                allStudents = res.data;
            } else if (res.data?.data) {
                allStudents = res.data.data;
            } else if (res.data?.students) {
                allStudents = res.data.students;
            }

            const t002Students = allStudents.filter((student: any) => {
                const hasT002Doc = student.documents?.some((doc: any) => doc.type === 'T002_FORM');
                const isStatusMatch = ['T002_SUBMITTED', 'T002_EDITS_REQUIRED', 'INTERNSHIP_STARTED'].includes(student.coop?.status || student.docStatus);
                return hasT002Doc || isStatusMatch;
            });

            setStudents(t002Students);
        } catch (err) {
            console.error("Fetch data error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAllData(); }, []);

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

    // Helper หาระดับสถานะของ T002
    const getT002Status = (student: Student) => {
        const t002Doc = student.documents?.find(d => d.type === "T002_FORM");
        const docStatus = t002Doc?.status || 'WAITING';
        const profileStatus = student.coop?.status || student.docStatus;

        if (profileStatus === 'INTERNSHIP_STARTED' || docStatus === 'APPROVED') return { label: "✅ ตรวจผ่านแล้ว", color: "#10b981", bg: "#dcfce7" };
        if (profileStatus === 'T002_EDITS_REQUIRED' || docStatus === 'EDITS_REQUIRED' || docStatus === 'REJECTED') return { label: "⚠️ ตีกลับให้แก้ไข", color: "#dc2626", bg: "#fee2e2" };
        return { label: "📄 รอการตรวจสอบ", color: "#0d9488", bg: "#ccfbf1" };
    };

    // 🟢 จัดการการกด Header เพื่อเรียงลำดับ
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
        // 1. กรองข้อมูล (Filter)
        let filtered = students.filter(s => {
            const matchSearch = `${s.studentId} ${s.firstName} ${s.lastName} ${s.coop?.company?.name || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
            return matchSearch;
        });

        // 2. เรียงลำดับ (Sort)
        filtered.sort((a, b) => {
            let valA = '';
            let valB = '';

            switch (sortKey) {
                case 'studentId':
                    valA = a.studentId || ''; valB = b.studentId || ''; break;
                case 'name':
                    valA = `${a.firstName} ${a.lastName}`; valB = `${b.firstName} ${b.lastName}`; break;
                case 'company':
                    valA = a.coop?.company?.name || ''; valB = b.coop?.company?.name || ''; break;
                case 'status':
                    valA = getT002Status(a).label; valB = getT002Status(b).label; break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [students, searchTerm, sortKey, sortDirection]);

    // 2. เปิด Modal ตรวจเอกสาร
    const openReviewModal = (student: Student) => {
        setSelectedStudent(student);
        setComment("");
        setModalOpen(true);
    };

    // 3. ฟังก์ชันดึง URL ของไฟล์ T002
    const getT002FileUrl = (docs: Document[]) => {
        const file = docs?.find(d => d.type === "T002_FORM");
        return file ? `/uploads/${file.path}` : null;
    };

    const loadConfig = async () => {
        try {
            const token = localStorage.getItem("coop.token");
            const res = await fetch("/api/admin/config/t002", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setConfig(await res.json());
        } catch (err) { console.error("Load config error", err); }
    };

    useEffect(() => { loadConfig(); }, []);

    const handleSaveConfig = async () => {
        try {
            const token = localStorage.getItem("coop.token");
            const res = await fetch("/api/admin/config/t002", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(config)
            });
            if (res.ok) alert("✅ บันทึกการตั้งค่าวันเวลาเรียบร้อยแล้ว");
        } catch (err) { alert("เกิดข้อผิดพลาดในการบันทึก"); }
    };

    // 4. บันทึกผลการตรวจ
    const submitReview = async (action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !comment.trim()) {
            return alert("กรุณาระบุเหตุผลที่ตีกลับ เพื่อให้นักศึกษาแก้ไข");
        }
        if (!confirm(`ยืนยันการ ${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'} เอกสาร T002?`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem("coop.token");
            // อนุมัติ T002 ไม่ต้องเปลี่ยน coop.status ไปข้างหน้า (ยังไม่มีสถานะ "T002_APPROVED")
            // ส่งสถานะปัจจุบันกลับไปเฉยๆ ป้องกันค่าเดิมถูกเขียนทับเป็น INTERNSHIP_STARTED (ย้อนสถานะ)
            const newStatus = action === 'APPROVE' ? (selectedStudent?.coop?.status || 'T002_SUBMITTED') : 'T002_EDITS_REQUIRED';

            await axios.put(`/api/admin/documents/review-t002`, {
                studentId: selectedStudent?.id,
                status: newStatus,
                comment: action === 'REJECT' ? comment : null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert(`บันทึกผลเรียบร้อย (${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'})`);
            setModalOpen(false);
            fetchAllData();
        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setLoading(false);
        }
    };

    // UI HELPER: แสดงลูกศรเรียงลำดับ
    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <span style={{ color: '#cbd5e1', marginLeft: 4 }}>↕</span>;
        return <span style={{ color: '#0ea5e9', marginLeft: 4 }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* ================= HEADER & FILTER ================= */}
            <section style={{ ...card, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>

                    <div>
                        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📝 ตรวจสอบแบบฟอร์ม T002</h2>
                        <div style={{ color: "#64748b", fontSize: 14, marginTop: 6 }}>
                            รายการแบบแจ้งรายละเอียดงานและที่พัก (ระหว่างฝึกงาน)
                        </div>
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
                                <option key={p.id} value={p.id}>เทอม {p.semester} / {p.academicYear}</option>
                            ))}
                        </select>

                        <button className="btn-ghost" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={fetchAllData} disabled={loading}>
                            {loading ? '⏳' : '🔄'} รีเฟรช
                        </button>

                        <div style={{ background: '#ecfdf5', color: '#047857', padding: '10px 16px', borderRadius: 8, fontWeight: 700, border: '1px solid #a7f3d0' }}>
                            ทั้งหมด: {processedStudents.length} รายการ
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= CONFIG SECTION ================= */}
            <section className="card" style={{ marginBottom: 24, borderLeft: `5px solid ${isSystemOpen ? '#10b981' : '#ef4444'}`, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>⚙️ จัดการเวลาส่งเอกสาร (T002)</h3>
                        <div style={{ fontSize: 13, marginTop: 6, color: isSystemOpen ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {isSystemOpen ? "🟢 สถานะ: เปิดรับเอกสาร" : "🔴 สถานะ: ปิดรับเอกสาร"}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div>
                            <label style={{ fontSize: 12, display: 'block', color: '#64748b', marginBottom: 6, fontWeight: 700 }}>วันเปิดรับ</label>
                            <input type="date" className="input" value={config.startDate} onChange={e => setConfig({ ...config, startDate: e.target.value })} style={{ background: '#fff' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, display: 'block', color: '#64748b', marginBottom: 6, fontWeight: 700 }}>วันปิดรับ</label>
                            <input type="date" className="input" value={config.endDate} onChange={e => setConfig({ ...config, endDate: e.target.value })} style={{ background: '#fff' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: 42, gap: 16 }}>
                            <label style={{ fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#334155' }}>
                                <input type="checkbox" checked={config.isOpen} onChange={e => setConfig({ ...config, isOpen: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#0ea5e9' }} />
                                เปิดระบบ
                            </label>
                            <button className="btn" style={{ background: '#0ea5e9', color: 'white', padding: '10px 20px', height: 42 }} onClick={handleSaveConfig}>
                                💾 บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* TABLE */}
            <section style={card}>
                <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#0369a1' }} data-label="รหัสนักศึกษา">{s.studentId}</td>
                                    <td style={{ padding: '14px 16px', fontSize: 14, color: '#1e293b', fontWeight: 600 }} data-label="ชื่อ-นามสกุล">{s.firstName} {s.lastName}</td>
                                    <td style={{ padding: '14px 16px', fontSize: 14, color: '#475569' }} data-label="สถานที่ฝึกงาน">{s.coop?.company?.name || "-"}</td>
                                    <td style={{ padding: '14px 16px', fontSize: 13 }} data-label="สถานะ">
                                        <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: '6px 12px', borderRadius: 999, fontWeight: 700 }}>
                                            {statusInfo.label}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                        <button className="btn" style={{ padding: '8px 16px', fontSize: 13, background: statusInfo.label.includes('รอการตรวจสอบ') ? '#0ea5e9' : '#64748b' }} onClick={() => openReviewModal(s)}>
                                            🔍 ตรวจเอกสาร
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </section>

            {/* MODAL ตรวจเอกสาร */}
            {modalOpen && selectedStudent && (
                <div style={modalOverlay}>
                    <div style={modalContentLarge}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 20 }}>
                                🔍 ตรวจสอบ T002: {selectedStudent.firstName} {selectedStudent.lastName}
                            </h3>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>

                        <div className="review-split" style={{ display: 'flex', gap: 24, height: '70vh' }}>
                            <div className="review-preview" style={{ flex: 1, background: '#525659', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {getT002FileUrl(selectedStudent.documents || []) ? (
                                    <iframe src={getT002FileUrl(selectedStudent.documents || []) as string} width="100%" height="100%" style={{ border: 'none' }} title="PDF Preview" />
                                ) : (
                                    <div style={{ color: 'white', margin: 'auto' }}>⚠️ ไม่พบไฟล์ T002 ในระบบ</div>
                                )}
                            </div>

                            <div className="review-sidebar" style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>ข้อมูลนักศึกษา</h4>
                                    <div style={{ fontSize: 13, color: '#475569', lineHeight: '1.6' }}>
                                        <b>รหัส:</b> {selectedStudent.studentId} <br />
                                        <b>สถานประกอบการ:</b> {selectedStudent.coop?.company?.name || "-"}
                                    </div>
                                </div>

                                <div>
                                    <label style={label}>ข้อความแจ้งนักศึกษา / เหตุผลที่ตีกลับ</label>
                                    <AutoTextarea className="input" rows={5} placeholder="เช่น ลายเซ็นไม่ครบ, โปรดระบุเบอร์โทรฉุกเฉิน..." value={comment} onChange={(e) => setComment(e.target.value)} />
                                </div>

                                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button className="btn-danger" style={{ padding: 14 }} onClick={() => submitReview('REJECT')} disabled={loading}>
                                        ❌ ตีกลับให้แก้ไข
                                    </button>
                                    <button className="btn-success" style={{ padding: 14 }} onClick={() => submitReview('APPROVE')} disabled={loading}>
                                        ✅ อนุมัติเอกสาร T002
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .input { padding: 12px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box; }
        .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); }
        @media (max-width: 768px) {
            .review-split { flex-direction: column !important; height: auto !important; }
            .review-preview { height: 320px !important; flex: none !important; }
            .review-sidebar { width: 100% !important; }
        }
      `}</style>
        </div>
    );
}

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const label: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContentLarge: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, width: "95%", maxWidth: 1200, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };