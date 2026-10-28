import Spinner from "./Spinner";
import { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import { apiFetch } from "../utils/apiFetch";
import { defaultPeriodId } from "../utils/defaultPeriod";
import { loadReviewCounts, loadReviewStudents, pendingOutside, periodCountLabel, type PeriodCount } from "../utils/reviewStudents";
import { useToast } from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import AutoTextarea from "./AutoTextarea";
import LoadMoreFooter from "./LoadMoreFooter";
import { useLoadMore } from "../utils/useLoadMore";

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

export default function T_T003Review() {
    const toast = useToast();
    const [students, setStudents] = useState<Student[]>([]);
    const [confirmState, setConfirmState] = useState<{
        open: boolean; title: string; message: string; icon?: string;
        confirmLabel?: string; confirmColor?: string; onConfirm: () => void;
    }>({ open: false, title: "", message: "", onConfirm: () => {} });
    const openConfirm = (opts: Omit<typeof confirmState, "open">) =>
        setConfirmState({ ...opts, open: true });
    const closeConfirm = () => setConfirmState(s => ({ ...s, open: false }));

    // ✅ State สำหรับค้นหาและตัวกรองปีการศึกษา
    const [coopPeriods, setCoopPeriods] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>(""); // "" = ยังไม่โหลดรอบ → ตั้งเป็นรอบล่าสุด
    const [listTotal, setListTotal] = useState(0);
    const [periodCounts, setPeriodCounts] = useState<PeriodCount[]>([]);
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
            // ครั้งแรกเปิดที่รอบที่เปิดอยู่ (utils/defaultPeriod) · งานค้างรอบอื่นขึ้นปุ่มเตือน (pendingOutside)
            let period = selectedPeriod;
            const [resPeriods, counts] = await Promise.all([apiFetch("/api/admin/coop-periods/all"), loadReviewCounts("T003")]);
            setPeriodCounts(counts);
            if (resPeriods.ok) {
                const periodsData = await resPeriods.json();
                if (periodsData.ok && periodsData.periods) {
                    setCoopPeriods(periodsData.periods);
                    if (!period) period = defaultPeriodId(periodsData.periods);
                }
            }
            if (!period) period = "all";
            if (period !== selectedPeriod) setSelectedPeriod(period); // effect ด้านล่างโหลดรายชื่อ
            else await reloadStudents(period);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchStudents(); }, []);

    // server กรองเฉพาะนักศึกษาที่เกี่ยวกับ T003 และแนบเฉพาะไฟล์ T003_FORM
    const reloadStudents = async (period: string) => {
        try {
            const [{ students: list, total }, counts] = await Promise.all([loadReviewStudents<Student>("T003", period), loadReviewCounts("T003")]);
            setStudents(list);
            setListTotal(total);
            setPeriodCounts(counts);
        } catch (err) { console.error(err); }
    };
    useEffect(() => {
        if (selectedPeriod) reloadStudents(selectedPeriod);
    }, [selectedPeriod]);

    const getT003Status = (student: Student) => {
        const t003Doc = student.documents?.find(d => d.type === "T003_FORM");
        const docStatus = t003Doc?.status || 'WAITING';
        const profileStatus = student.coop?.status || student.docStatus;

        if (profileStatus === 'T003_APPROVED' || profileStatus === 'INTERNSHIP_STARTED' || docStatus === 'APPROVED') {
            return { label: "✅ พิจารณาผ่านแล้ว", color: "#1d4ed8", bg: "#dbeafe" };
        }
        if (profileStatus === 'T003_EDITS_REQUIRED' || docStatus === 'EDITS_REQUIRED' || docStatus === 'REJECTED') {
            return { label: "⚠️ ตีกลับให้แก้ไข", color: "#dc2626", bg: "#fee2e2" };
        }
        return { label: "📄 รอการพิจารณา", color: "#2563eb", bg: "#bfdbfe" };
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
                case 'status': valA = getT003Status(a).label; valB = getT003Status(b).label; break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [students, searchTerm, sortKey, sortDirection]);

    // แสดงทีละ 30 รายการ เลื่อนถึงท้ายตารางแล้วแสดงเพิ่ม แทนโหลดทั้งหมดในตารางเดียว
    const { shown: shownStudents, hasMore, sentinelRef, showMore, total } = useLoadMore(processedStudents, `${searchTerm}|${selectedPeriod}`);

    const openReviewModal = (student: Student) => { setSelectedStudent(student); setComment(""); setModalOpen(true); };

    const getT003FileUrl = (docs: Document[]) => {
        const file = docs?.find(d => d.type === "T003_FORM");
        return file ? `/uploads/${file.path}` : null;
    };

    const submitReview = (action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !comment.trim()) {
            toast.warning("กรุณาระบุข้อเสนอแนะในการแก้โครงร่าง");
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
                    await axios.put(`/api/teacher/documents/review-t003`, {
                        studentId: selectedStudent?.id, status: newStatus,
                        comment: action === 'REJECT' ? comment : null
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    toast.success(`บันทึกผลเรียบร้อย (${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'})`);
                    setModalOpen(false);
                    reloadStudents(selectedPeriod);
                } catch { toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล"); }
                finally { setLoading(false); }
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
            <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e3a8a' }}>📘 ตรวจสอบ T003 </h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>รายชื่อนักศึกษาในความดูแลที่รอพิจารณาโครงร่างรายงาน (Proposal)</div>
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
                            <option key={p.id} value={String(p.id)}>เทอม {p.semester} / {p.academicYear}{periodCountLabel(periodCounts, p.id)}</option>
                        ))}
                    </select>
                        {pendingOutside(periodCounts, selectedPeriod) > 0 && (
                            <button type="button" onClick={() => setSelectedPeriod("all")}
                                style={{ fontSize: 12, color: '#b45309', fontWeight: 700, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                                ⚠️ รอตรวจในรอบอื่นอีก {pendingOutside(periodCounts, selectedPeriod)} คน — ดูทุกปีการศึกษา
                            </button>
                        )}
                        {listTotal > students.length && (
                            <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>แสดง {students.length} จาก {listTotal} คน — เลือกรอบเพื่อดูครบ</span>
                        )}

                    <button className="btn-secondary" onClick={fetchStudents} disabled={loading}>
                        {loading ? <Spinner size={14} /> : '🔄'} รีเฟรช
                    </button>

                    <div style={{ background: '#dbeafe', color: '#1e40af', padding: '10px 16px', borderRadius: 8, fontWeight: 700, border: '1px solid #bfdbfe' }}>
                        ทั้งหมด: {total} รายการ
                    </div>
                </div>
            </section>

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
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>🎉 ไม่มีเอกสาร T003 ในระบบ</td></tr>
                        ) : shownStudents.map(s => {
                            const statusInfo = getT003Status(s);
                            return (
                                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#2563eb' }} data-label="รหัสนักศึกษา">{s.studentId}</td>
                                    <td style={{ padding: '14px 16px', fontWeight: 600 }} data-label="ชื่อ-นามสกุล">{s.firstName} {s.lastName}</td>
                                    <td style={{ padding: '14px 16px', color: '#475569' }} data-label="สถานที่ฝึกงาน">{s.coop?.company?.name || "-"}</td>
                                    <td style={{ padding: '14px 16px', fontSize: 13 }} data-label="สถานะ">
                                        <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: '6px 12px', borderRadius: 999, fontWeight: 700 }}>
                                            {statusInfo.label}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                        <button className={statusInfo.label.includes('รอการพิจารณา') ? "btn small" : "btn-secondary small"} onClick={() => openReviewModal(s)}>🔍 พิจารณา</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                <LoadMoreFooter shownCount={shownStudents.length} total={total} hasMore={hasMore} onShowMore={showMore} sentinelRef={sentinelRef} itemLabel="รายการ" />
            </section>

            {modalOpen && selectedStudent && (
                <div style={modalOverlay}>
                    <div style={modalContentLarge}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 15, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: '#1e3a8a', fontSize: 20 }}>🔍 พิจารณา T003: {selectedStudent.firstName}</h3>
                            <button className="modal-close" aria-label="ปิด" onClick={() => setModalOpen(false)}>&times;</button>
                        </div>
                        <div className="review-split" style={{ display: 'flex', gap: 24, height: '70vh' }}>
                            <div className="review-preview" style={{ flex: 1, background: '#525659', borderRadius: 8, overflow: 'hidden' }}>
                                {getT003FileUrl(selectedStudent.documents || []) ? (
                                    <iframe src={getT003FileUrl(selectedStudent.documents || []) as string} width="100%" height="100%" style={{ border: 'none' }} title="PDF Preview" />
                                ) : <div style={{ color: 'white', padding: 20, textAlign: 'center', marginTop: 50 }}>⚠️ ไม่พบไฟล์ T003</div>}
                            </div>
                            <div className="review-sidebar" style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={label}>ข้อเสนอแนะในการปรับแก้โครงร่าง</label>
                                    <AutoTextarea className="input" rows={6} value={comment} onChange={(e) => setComment(e.target.value)} />
                                </div>
                                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button className="btn-danger" style={{ padding: 14 }} onClick={() => submitReview('REJECT')} disabled={loading}>❌ ตีกลับให้แก้ไข</button>
                                    <button className="btn-success" style={{ padding: 14 }} onClick={() => submitReview('APPROVE')} disabled={loading}>✅ อนุมัติโครงร่างรายงาน</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style>{` .input { padding: 12px 14px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; outline: none; font-family: inherit; } .input:focus{ border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); } @media (max-width: 768px) { .review-split { flex-direction: column !important; height: auto !important; } .review-preview { height: 320px !important; flex: none !important; } .review-sidebar { width: 100% !important; } } `}</style>
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
const modalOverlay: CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContentLarge: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, width: "95%", maxWidth: 1200, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };