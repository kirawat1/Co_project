import React, { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import { useToast } from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
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
    coop: {
        coopPeriodId?: number; // ✅ เผื่อกรณีซ้อนอยู่ในนี้
        company: {
            name: string;
        }
        status?: string;
    };
    documents: Document[];
};

// 🟢 Types สำหรับการเรียงลำดับ (Sorting)
type SortKey = 'studentId' | 'name' | 'company' | 'status';
type SortDirection = 'asc' | 'desc';

export default function A_DocT003Review() {
    const toast = useToast();
    const [students, setStudents] = useState<Student[]>([]);
    const [confirmState, setConfirmState] = useState<{
        open: boolean; title: string; message: string; icon?: string;
        confirmLabel?: string; confirmColor?: string; onConfirm: () => void;
    }>({ open: false, title: "", message: "", onConfirm: () => {} });
    const openConfirm = (opts: Omit<typeof confirmState, "open">) =>
        setConfirmState({ ...opts, open: true });
    const closeConfirm = () => setConfirmState(s => ({ ...s, open: false }));

    // ✅ State สำหรับเก็บรอบปีการศึกษาและคำค้นหา
    const [coopPeriods, setCoopPeriods] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({ startDate: "", endDate: "", isOpen: false });

    // 🟢 State สำหรับการเรียงลำดับ (Sorting)
    const [sortKey, setSortKey] = useState<SortKey>('studentId');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const isSystemOpen = useMemo(() => {
        const now = new Date().getTime();
        const start = config.startDate ? new Date(config.startDate).getTime() : 0;
        const end = config.endDate ? new Date(config.endDate).getTime() : 0;
        return config.isOpen && ((!start && !end) || (now >= start && now <= end));
    }, [config]);

    const loadConfig = async () => {
        try {
            const token = localStorage.getItem("coop.token");
            const res = await fetch("/api/admin/config/t003", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setConfig(await res.json());
        } catch (err) { console.error("Load config error", err); }
    };

    useEffect(() => { loadConfig(); }, []);

    const handleSaveConfig = async () => {
        try {
            const token = localStorage.getItem("coop.token");
            const res = await fetch("/api/admin/config/t003", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(config)
            });
            if (res.ok) toast.success("บันทึกการตั้งค่าวันเวลาเรียบร้อยแล้ว");
            else toast.error("บันทึกไม่สำเร็จ");
        } catch { toast.error("เกิดข้อผิดพลาดในการบันทึก"); }
    };

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

            const t003Students = allStudents.filter((student: any) => {
                const hasT003Doc = student.documents?.some((doc: any) => doc.type === 'T003_FORM');
                const isStatusMatch = ['T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED', 'INTERNSHIP_STARTED'].includes(student.coop?.status || student.docStatus);
                return hasT003Doc || isStatusMatch;
            });

            setStudents(t003Students);
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
                const hasT003Doc = s.documents?.some((d: any) => d.type === 'T003_FORM');
                const isStatusMatch = ['T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED', 'INTERNSHIP_STARTED'].includes(s.coop?.status || s.docStatus);
                return hasT003Doc || isStatusMatch;
            }));
        } catch (err) { console.error(err); }
    };
    const initialPeriodMount = useRef(true);
    useEffect(() => {
        if (initialPeriodMount.current) { initialPeriodMount.current = false; return; }
        reloadStudents(selectedPeriod);
    }, [selectedPeriod]);

    // Helper หาระดับสถานะของ T003
    const getT003Status = (student: Student) => {
        const t003Doc = student.documents.find(d => d.type === "T003_FORM");
        const docStatus = t003Doc?.status || 'WAITING';
        const profileStatus = student.coop?.status || student.docStatus;

        if (profileStatus === 'T003_APPROVED' || profileStatus === 'INTERNSHIP_STARTED' || docStatus === 'APPROVED') {
            return { label: "✅ พิจารณาผ่านแล้ว", color: "#1d4ed8", bg: "#dbeafe", btnBg: "#64748b" };
        }
        if (profileStatus === 'T003_EDITS_REQUIRED' || docStatus === 'EDITS_REQUIRED' || docStatus === 'REJECTED') {
            return { label: "⚠️ ตีกลับให้แก้ไข", color: "#dc2626", bg: "#fee2e2", btnBg: "#ef4444" };
        }
        return { label: "📄 รอการพิจารณา", color: "#2563eb", bg: "#bfdbfe", btnBg: "#2563eb" };
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
                    valA = getT003Status(a).label; valB = getT003Status(b).label; break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [students, searchTerm, sortKey, sortDirection]);

    const openReviewModal = (student: Student) => {
        setSelectedStudent(student);
        setComment("");
        setModalOpen(true);
    };

    const getT003FileUrl = (docs: Document[]) => {
        const file = docs.find(d => d.type === "T003_FORM");
        return file ? `/uploads/${file.path}` : null;
    };

    const submitReview = (action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !comment.trim()) {
            toast.warning("กรุณาระบุเหตุผลที่ตีกลับ เพื่อให้นักศึกษาแก้ไข");
            return;
        }
        openConfirm({
            title: action === 'APPROVE' ? "ยืนยันอนุมัติ T003" : "ยืนยันตีกลับ T003",
            message: `${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'} โครงร่างรายงานของ ${selectedStudent?.firstName} ${selectedStudent?.lastName}?`,
            icon: action === 'APPROVE' ? "✅" : "⚠️",
            confirmLabel: action === 'APPROVE' ? "อนุมัติ" : "ตีกลับ",
            confirmColor: action === 'APPROVE' ? "#10b981" : "#f59e0b",
            onConfirm: async () => {
                closeConfirm();
                setLoading(true);
                try {
                    const token = localStorage.getItem("coop.token");
                    const newStatus = action === 'APPROVE' ? 'T003_APPROVED' : 'T003_EDITS_REQUIRED';
                    await axios.put(`/api/admin/documents/review-t003`, {
                        studentId: selectedStudent?.id, status: newStatus,
                        comment: action === 'REJECT' ? comment : null
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    toast.success(`บันทึกผลเรียบร้อย (${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'})`);
                    setModalOpen(false);
                    fetchAllData();
                } catch {
                    toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    // UI HELPER: แสดงลูกศรเรียงลำดับ
    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <span style={{ color: '#cbd5e1', marginLeft: 4 }}>↕</span>;
        return <span style={{ color: '#2563eb', marginLeft: 4 }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* ================= HEADER & FILTER ================= */}
            <section style={{ ...card, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>

                    {/* ส่วนซ้าย: ข้อความหัวเรื่อง */}
                    <div>
                        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e3a8a' }}>📘 ตรวจสอบแบบฟอร์ม T003 (Proposal)</h2>
                        <div style={{ color: "#64748b", fontSize: 14, marginTop: 6 }}>
                            รายการนักศึกษาที่ส่งโครงร่างรายงานและแผนปฏิบัติงาน
                        </div>
                    </div>

                    {/* ส่วนขวา: ช่องค้นหา และ Dropdown */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>

                        {/* 🟢 ช่องค้นหา */}
                        <input
                            className="input"
                            placeholder="🔍 ค้นหารหัส / ชื่อ / บริษัท..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: 250 }}
                        />

                        {/* Dropdown เลือกปีการศึกษา */}
                        <select className="input" style={{ width: 'auto', background: '#f8fafc', padding: '10px 14px' }} value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
                            <option value="all">📚 ทุกปีการศึกษา</option>
                            {coopPeriods.map(p => (
                                <option key={p.id} value={String(p.id)}>เทอม {p.semester} / {p.academicYear}</option>
                            ))}
                        </select>

                        <button className="btn-ghost" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={fetchAllData} disabled={loading}>
                            {loading ? '⏳' : '🔄'} รีเฟรช
                        </button>

                        <div style={{ background: '#dbeafe', color: '#1e40af', padding: '10px 16px', borderRadius: 8, fontWeight: 700, border: '1px solid #bfdbfe' }}>
                            ทั้งหมด: {processedStudents.length} รายการ
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= CONFIG SECTION ================= */}
            <section className="card" style={{ marginBottom: 24, borderLeft: `5px solid ${isSystemOpen ? '#10b981' : '#ef4444'}`, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>

                    {/* ข้อมูลสถานะระบบ */}
                    <div>
                        <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>⚙️ จัดการเวลาส่งเอกสาร (T003)</h3>
                        <div style={{ fontSize: 13, marginTop: 6, color: isSystemOpen ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {isSystemOpen ? "🟢 สถานะ: เปิดรับเอกสาร" : "🔴 สถานะ: ปิดรับเอกสาร"}
                        </div>
                    </div>

                    {/* เครื่องมือตั้งเวลา */}
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
                                <input type="checkbox" checked={config.isOpen} onChange={e => setConfig({ ...config, isOpen: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#2563eb' }} />
                                เปิดระบบ
                            </label>
                            <button className="btn" style={{ background: '#2563eb', color: 'white', padding: '10px 20px', height: 42 }} onClick={handleSaveConfig}>
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
                                สถานที่ปฏิบัติงาน <SortIcon columnKey="company" />
                            </th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>
                                สถานะ <SortIcon columnKey="status" />
                            </th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedStudents.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>🎉 ไม่มีโครงร่างรายงาน (T003) ในระบบ</td></tr>
                        ) : processedStudents.map(s => {
                            const statusInfo = getT003Status(s);

                            return (
                                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#2563eb' }} data-label="รหัสนักศึกษา">{s.studentId}</td>
                                    <td style={{ padding: '14px 16px', fontSize: 14, color: '#1e293b', fontWeight: 600 }} data-label="ชื่อ-นามสกุล">{s.firstName} {s.lastName}</td>
                                    <td style={{ padding: '14px 16px', fontSize: 14, color: '#475569' }} data-label="สถานที่ปฏิบัติงาน">{s.coop?.company?.name || "-"}</td>
                                    <td style={{ padding: '14px 16px', fontSize: 13 }} data-label="สถานะ">
                                        <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: '6px 12px', borderRadius: 999, fontWeight: 700 }}>
                                            {statusInfo.label}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                        <button className="btn" style={{ padding: '8px 16px', fontSize: 13, background: statusInfo.btnBg }} onClick={() => openReviewModal(s)}>
                                            🔍 พิจารณา
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
                            <h3 style={{ margin: 0, color: '#1e3a8a', fontSize: 20 }}>
                                🔍 พิจารณาโครงร่าง (T003): {selectedStudent.firstName} {selectedStudent.lastName}
                            </h3>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>

                        <div className="review-split" style={{ display: 'flex', gap: 24, height: '75vh' }}>
                            <div className="review-preview" style={{ flex: 1, background: '#525659', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {getT003FileUrl(selectedStudent.documents) ? (
                                    <iframe src={getT003FileUrl(selectedStudent.documents) as string} width="100%" height="100%" style={{ border: 'none' }} title="PDF Preview" />
                                ) : (
                                    <div style={{ color: 'white', margin: 'auto' }}>⚠️ ไม่พบไฟล์ T003 ในระบบ</div>
                                )}
                            </div>

                            <div className="review-sidebar" style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>ข้อมูลนักศึกษา</h4>
                                    <div style={{ fontSize: 13, color: '#475569', lineHeight: '1.6' }}>
                                        <b>รหัส:</b> {selectedStudent.studentId} <br />
                                        <b>สถานที่ปฏิบัติงาน:</b> {selectedStudent.coop?.company?.name || "-"}
                                    </div>
                                </div>

                                <div>
                                    <label style={label}>ข้อเสนอแนะ / เหตุผลที่ให้แก้ไข</label>
                                    <AutoTextarea className="input" rows={6} placeholder="เช่น หัวข้อยังกว้างเกินไป, กรุณาเพิ่มรายละเอียดในสัปดาห์ที่ 2..." value={comment} onChange={(e) => setComment(e.target.value)} />
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>* หากอนุมัติ ไม่จำเป็นต้องกรอกข้อความ</div>
                                </div>

                                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button className="btn-ghost" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5', padding: 14 }} onClick={() => submitReview('REJECT')} disabled={loading}>
                                        ❌ ตีกลับให้แก้ไข
                                    </button>
                                    <button className="btn" style={{ background: '#2563eb', padding: 14 }} onClick={() => submitReview('APPROVE')} disabled={loading}>
                                        ✅ อนุมัติโครงร่างรายงาน
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .btn { border-radius: 8px; border: none; font-weight: 700; color: white; cursor: pointer; transition: 0.2s; }
                .btn:hover:not(:disabled) { opacity: 0.9; }
                .btn-ghost { border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; background: #fff; cursor: pointer; transition: 0.2s; }
                .btn-ghost:hover:not(:disabled) { background: #f1f5f9; }
                .input { padding: 12px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box; }
                .input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
                @media (max-width: 768px) {
                    .review-split { flex-direction: column !important; height: auto !important; }
                    .review-preview { height: 320px !important; flex: none !important; }
                    .review-sidebar { width: 100% !important; }
                }
            `}</style>
            <ConfirmDialog
                open={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                icon={confirmState.icon}
                confirmLabel={confirmState.confirmLabel}
                confirmColor={confirmState.confirmColor}
                onConfirm={confirmState.onConfirm}
                onCancel={closeConfirm}
            />
        </div>
    );
}

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const label: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContentLarge: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, width: "95%", maxWidth: 1200, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };