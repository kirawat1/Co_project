import React, { useMemo, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import StatusBadge from "./StatusBadge";
import AutoTextarea from "./AutoTextarea";
import { useToast } from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import Spinner from "./Spinner";
import { useDebounce } from "../hooks/useDebounce";
import LoadMoreFooter from "./LoadMoreFooter";
import A_ApplyWindowCard from "./A_ApplyWindowCard";
import { useLoadMore } from "../utils/useLoadMore";

function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) ? url : undefined; }
  catch { return undefined; }
}

// ================= TYPES =================
type Document = { id: number; name: string; path: string; type: string };
type Mentor = { id: string; firstName: string; lastName: string; email: string; phone?: string; position?: string; };
type Company = { id: string; name: string; address?: string; phone?: string; contactPerson?: string; contactPosition?: string; };
type Student = {
    id: number; studentId: string; prefix?: string; firstName: string; lastName: string;
    firstNameEn?: string; lastNameEn?: string; year?: string; major: string;
    advisorName?: string; phone?: string; email?: string;
    coopPeriodId?: number;
    documents: Document[];
    coopApplicationForm?: { gradeSheetUrl?: string | null } | null;
};
type CoopApp = {
    id: number;
    student: Student;
    company: Company | null;
    mentor: Mentor | null;
    jobPosition: string;
    status: string;
    staffCheckComment: string | null;
    updatedAt: string;
    coopPeriodId?: number; // ✅ เพิ่มเพื่อเช็คปีการศึกษา
};
type CoopPeriod = {
    id: number;
    semester: string | number;
    academicYear: string;
    isActive: boolean;
};

// ================= COMPONENT =================
export default function A_CoopApplications() {
    const toast = useToast();
    const [apps, setApps] = useState<CoopApp[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [filterStatus, setFilterStatus] = useState("ALL");

    // ✅ State สำหรับเก็บรอบปีการศึกษาและตัวกรอง
    const [coopPeriods, setCoopPeriods] = useState<CoopPeriod[]>([]);
    const [filterPeriodId, setFilterPeriodId] = useState<string>("all");

    // Modal & Preview State
    const [selectedApp, setSelectedApp] = useState<CoopApp | null>(null);
    const [comment, setComment] = useState("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<'pdf' | 'image' | null>(null);

    // ConfirmDialog state
    const [confirmState, setConfirmState] = useState<{
        open: boolean; title: string; message: string; icon?: string;
        confirmLabel?: string; confirmColor?: string; onConfirm: () => void;
    }>({ open: false, title: "", message: "", onConfirm: () => {} });

    const token = localStorage.getItem("coop.token");

    const openConfirm = (opts: Omit<typeof confirmState, "open">) =>
        setConfirmState({ ...opts, open: true });
    const closeConfirm = () =>
        setConfirmState(s => ({ ...s, open: false }));

    const fetchApplications = async () => {
        setLoading(true);
        try {
            // 🟢 1. ดึงข้อมูลปีการศึกษา
            const resPeriods = await axios.get("/api/admin/coop-periods/all", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (resPeriods.data?.periods) {
                setCoopPeriods(resPeriods.data.periods);
            }

            // 🟢 2. ดึงข้อมูลคำร้อง
            const resApps = await axios.get("/api/admin/coop-applications", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (resApps.data.ok) setApps(resApps.data.applications);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { fetchApplications(); }, []);

    // รายการรอตรวจที่ตรงกับปีการศึกษา
    const qualifiedPendingList = useMemo(() => {
        return apps.filter(app => {
            // Only APPLYING needs bulk-qualify. WAITING_FOR_STAFF_CHECK students have
            // already been qualified AND submitted T000 — bulk-sending QUALIFIED would
            // rewind them, losing their T000 submission context.
            const isPending = app.status === "APPLYING";
            const appPeriodId = String(app.student.coopPeriodId || app.coopPeriodId || "");
            const matchPeriod = filterPeriodId === "all" || appPeriodId === filterPeriodId;

            return isPending && matchPeriod;
        });
    }, [apps, filterPeriodId]);

    // ฟังก์ชันอนุมัติกลุ่ม (Bulk Approve)
    const handleBulkApprove = () => {
        const count = qualifiedPendingList.length;
        if (count === 0) return;
        openConfirm({
            title: "ยืนยันอนุมัติกลุ่ม",
            message: `ระบบจะอนุมัติคำร้องของนักศึกษาที่ผ่านคุณสมบัติ จำนวน ${count} รายการ ดำเนินการต่อหรือไม่?`,
            icon: "⚡",
            confirmLabel: `อนุมัติ ${count} ราย`,
            confirmColor: "#10b981",
            onConfirm: async () => {
                closeConfirm();
                setLoading(true);
                try {
                    await Promise.all(qualifiedPendingList.map(app =>
                        axios.patch(`/api/admin/coop-applications/${app.id}/status`, {
                            status: "QUALIFIED",
                            comment: "อนุมัติโดยระบบ (ผ่านคุณสมบัติครบถ้วน)"
                        }, { headers: { Authorization: `Bearer ${token}` } })
                    ));
                    toast.success(`อนุมัติสำเร็จ ${count} รายการ`);
                    fetchApplications();
                } catch {
                    toast.error("เกิดข้อผิดพลาดในการอนุมัติกลุ่ม");
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const updateStatus = (status: string) => {
        if (!selectedApp) return;
        if (status === "APPLICATION_EDITS_REQUIRED" && !comment.trim()) {
            toast.warning("กรุณาระบุสิ่งที่ต้องแก้ไข เพื่อให้นักศึกษาทราบ");
            return;
        }
        const statusLabel: Record<string, string> = {
            QUALIFIED: "ผ่านคุณสมบัติ",
            APPLICATION_EDITS_REQUIRED: "ขอให้แก้ไข",
            QUALIFICATION_FAILED: "ไม่ผ่านคุณสมบัติ",
            PENDING_GRADE: "รอพิจารณาเกรด",
        };
        openConfirm({
            title: "ยืนยันการเปลี่ยนสถานะ",
            message: `เปลี่ยนสถานะเป็น "${statusLabel[status] ?? status}" สำหรับ ${selectedApp.student.firstName} ${selectedApp.student.lastName}?`,
            icon: "📋",
            confirmLabel: "ยืนยัน",
            confirmColor: status === "QUALIFICATION_FAILED" ? "#ef4444" : "#0074B7",
            onConfirm: async () => {
                closeConfirm();
                try {
                    await axios.patch(`/api/admin/coop-applications/${selectedApp.id}/status`, {
                        status,
                        comment: status === "APPLICATION_EDITS_REQUIRED" ? comment : null
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    toast.success("บันทึกสถานะเรียบร้อย");
                    closeAndResetModal();
                    fetchApplications();
                } catch {
                    toast.error("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
                }
            },
        });
    };

    const openReviewModal = (app: CoopApp) => {
        setSelectedApp(app);
        setComment(app.staffCheckComment || "");

        const gatewayDocs = app.student.documents.filter(d => d.type === 'APPLICATION_DOC');
        if (gatewayDocs.length > 0) {
            handlePreview(gatewayDocs[0]);
        } else {
            setPreviewUrl(null);
            setPreviewType(null);
        }
    };

    const handlePreview = (doc: Document) => {
        const cleanPath = doc.path.startsWith('/uploads/') ? doc.path : `/uploads/${doc.path}`;
        const url = cleanPath;
        setPreviewUrl(url);
        setPreviewType(doc.path.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
    };

    const closeAndResetModal = () => {
        setSelectedApp(null);
        setComment("");
        setPreviewUrl(null);
        setPreviewType(null);
    };

    // ✅ กรองตาราง
    const filteredApps = apps.filter(app => {
        const matchSearch = `${app.student.studentId} ${app.student.firstName} ${app.student.lastName} ${app.company?.name || ""}`.toLowerCase().includes(debouncedSearch.toLowerCase());
        // "ผ่านเกณฑ์แล้ว" = ตรวจผ่านแล้วทุกคน ไม่ว่าตอนนี้จะไปถึงขั้นไหน
        const matchStatus = filterStatus === "ALL"
            || (filterStatus === "QUALIFIED" ? isReviewedPass(app.status) : app.status === filterStatus);

        // กรองตามปีการศึกษา
        const appPeriodId = String(app.student.coopPeriodId || app.coopPeriodId || "");
        const matchPeriod = filterPeriodId === "all" || appPeriodId === filterPeriodId;

        // รอดำเนินการ = คำร้องที่ยังไม่ได้ตรวจเท่านั้น (เดิมนับ WAITING_FOR_STAFF_CHECK ด้วย ซึ่งเป็นคำร้องที่ผ่านแล้วและรอตรวจ T000)
        if (filterStatus === "PENDING") return matchSearch && matchPeriod && app.status === "APPLYING";
        return matchSearch && matchStatus && matchPeriod;
    });

    // แสดงทีละ 30 รายการ เลื่อนถึงท้ายตารางแล้วแสดงเพิ่ม แทนโหลดทั้งหมดในตารางเดียว
    const { shown: shownApps, hasMore, sentinelRef, showMore, total } = useLoadMore(filteredApps, `${debouncedSearch}|${filterStatus}|${filterPeriodId}`);

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
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

            {/* HEADER */}
            <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📂 ตรวจสอบคำร้องขอสหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>จัดการคำร้องเบื้องต้น และอนุมัติสถานะผ่านเกณฑ์</div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        className="btn"
                        onClick={handleBulkApprove}
                        disabled={qualifiedPendingList.length === 0 || loading}
                        style={{
                            background: qualifiedPendingList.length > 0 ? '#10b981' : '#e5e7eb',
                            color: qualifiedPendingList.length > 0 ? 'white' : '#9ca3af',
                            padding: '10px 20px'
                        }}
                    >
                        {loading ? <Spinner size={16} color={qualifiedPendingList.length > 0 ? "#fff" : "#9ca3af"} /> : "⚡"}
                        {" "}อนุมัติผู้ผ่านคุณสมบัติทั้งหมด ({qualifiedPendingList.length})
                    </button>
                    <button className="btn-ghost" onClick={fetchApplications} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {loading ? <Spinner size={15} /> : "🔄"} รีเฟรช
                    </button>
                </div>
            </section>

            {/* ช่วงเวลายื่นคำร้อง — ตั้งแยกจากรอบรับสมัคร แบบเดียวกับ T000–T003 */}
            <A_ApplyWindowCard />

            {/* FILTER & LIST */}
            <section style={card}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                    <input className="input" placeholder="🔍 ค้นหารหัส / ชื่อ / บริษัท..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, minWidth: 200 }} />

                    {/* 🟢 Dropdown เลือกปีการศึกษา */}
                    <select className="input" value={filterPeriodId} onChange={(e) => setFilterPeriodId(e.target.value)} style={{ width: 'auto', background: '#f8fafc' }}>
                        <option value="all">📚 ทุกปีการศึกษา</option>
                        {coopPeriods.map(p => (
                            <option key={p.id} value={p.id}>เทอม {p.semester}/{p.academicYear}</option>
                        ))}
                    </select>

                    <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
                        <option value="ALL">📋 แสดงทุกสถานะ</option>
                        <option value="PENDING">⏳ รอดำเนินการ</option>
                        <option value="PENDING_GRADE">📊 รอพิจารณาเกรด</option>
                        <option value="QUALIFIED">✅ ผ่านเกณฑ์แล้ว</option>
                        <option value="APPLICATION_EDITS_REQUIRED">⚠️ ส่งกลับแก้ไข</option>
                        <option value="QUALIFICATION_FAILED">❌ ไม่ผ่าน</option>
                    </select>
                </div>

                <table style={table} className="responsive-table">
                    <thead>
                        <tr style={thRow}>
                            <th style={th}>รหัสนักศึกษา / ชื่อ</th>
                            <th style={th}>หน่วยงาน / ตำแหน่ง</th>
                            <th style={th}>สถานะ</th>
                            <th style={{ ...th, textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredApps.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>ไม่มีคำร้องในระบบ</td></tr>
                        ) : shownApps.map(app => (
                            <tr key={app.id} style={tr}>
                                <td style={td} data-label="รหัสนักศึกษา / ชื่อ">
                                    <div style={{ fontWeight: 700, color: '#0369a1' }}>{app.student.studentId}</div>
                                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{app.student.firstName} {app.student.lastName}</div>
                                </td>
                                <td style={td} data-label="หน่วยงาน / ตำแหน่ง">
                                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{app.company?.name || "-"}</div>
                                    <div style={{ fontSize: 12, color: '#0ea5e9', marginTop: 2 }}>{app.jobPosition}</div>
                                </td>
                                <td style={td} data-label="สถานะ">
                                    {isReviewedPass(app.status) ? (
                                        <>
                                            {/* คำร้องตรวจผ่านแล้ว — สถานะจริงเดินต่อไปขั้น T000 แล้ว แสดงให้ชัดว่าหน้านี้ไม่ต้องทำอะไรต่อ */}
                                            <span style={reviewedBadge}>✅ ตรวจแล้ว · ผ่านเกณฑ์</span>
                                            {app.status !== "QUALIFIED" && (
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>ขั้นตอนตอนนี้: <StatusBadge status={app.status} showIcon={false} /></div>
                                            )}
                                        </>
                                    ) : (
                                        <StatusBadge status={app.status} />
                                    )}
                                </td>

                                <td style={{ ...td, textAlign: 'right' }}>
                                    <button className={isReviewedPass(app.status) ? "btn-secondary" : "btn"} style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => openReviewModal(app)}>
                                        {isReviewedPass(app.status) ? "📄 ดูคำร้อง" : "🔍 ตรวจคำร้อง"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <LoadMoreFooter shownCount={shownApps.length} total={total} hasMore={hasMore} onShowMore={showMore} sentinelRef={sentinelRef} itemLabel="รายการ" />
            </section>

            {/* MODAL: SPLIT SCREEN */}
            {selectedApp && (
                <div className="modal-backdrop">
                    <div className="modal-card-split">
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0, color: '#0f172a' }}>พิจารณาคำร้อง: {selectedApp.student.studentId}</h3>
                            <button onClick={closeAndResetModal} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>

                        <div className="split-pane" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* LEFT: PREVIEW */}
                            <div className="preview-pane" style={{ flex: '0 0 60%', background: '#334155' }}>
                                {previewUrl ? (
                                    previewType === 'pdf' ? <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="p" />
                                        : <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="p" />
                                ) : <div style={{ color: 'white', textAlign: 'center', marginTop: '20%' }}>เลือกไฟล์ด้านขวาเพื่อดู</div>}
                            </div>

                            {/* RIGHT: DETAILS */}
                            <div style={{ flex: 1, padding: 24, overflowY: 'auto', background: '#f8fafc' }}>
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: '#334155' }}>📄 เอกสารประกอบ</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {selectedApp.student.documents.filter(d => d.type === 'APPLICATION_DOC').map(doc => (
                                            <div key={doc.id} onClick={() => handlePreview(doc)}
                                                style={{
                                                    padding: 12, background: previewUrl?.includes(doc.path) ? '#e0f2fe' : '#fff',
                                                    border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                                                    borderLeft: previewUrl?.includes(doc.path) ? '4px solid #0ea5e9' : '1px solid #e2e8f0'
                                                }}>
                                                📄 {doc.name}
                                            </div>
                                        ))}
                                        {/* แบบฟอร์มตรวจสอบการสำเร็จการศึกษา */}
                                        {selectedApp.student.coopApplicationForm?.gradeSheetUrl ? (
                                            <a
                                                href={safeHref(selectedApp.student.coopApplicationForm.gradeSheetUrl)}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderLeft: "4px solid #2563eb", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#2563eb", textDecoration: "none" }}
                                            >
                                                📊 แบบฟอร์มตรวจสอบการสำเร็จการศึกษา
                                            </a>
                                        ) : (
                                            <div style={{ padding: 12, background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, fontSize: 12, color: "#94a3b8" }}>
                                                📊 ยังไม่ได้แนบแบบฟอร์มตรวจสอบการสำเร็จการศึกษา
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Student Info Box */}
                                <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontWeight: 800, marginBottom: 10, borderBottom: '1px solid #eee', paddingBottom: 8, color: '#334155' }}>👤 ข้อมูลผู้สมัคร</div>
                                    <div style={{ fontSize: 13, lineHeight: 2, color: '#475569' }}>
                                        <b>ชื่อ:</b> {selectedApp.student.firstName} {selectedApp.student.lastName}<br />
                                        <b>รหัสนักศึกษา:</b> {selectedApp.student.studentId}
                                    </div>
                                </div>

                                {/* Controls */}
                                <div style={{ marginTop: 30 }}>
                                    <AutoTextarea className="input" rows={4} style={{ width: '100%', marginBottom: 12 }}
                                        placeholder="ความเห็น/เหตุผลที่ตีกลับ (จำเป็นต้องกรอกเมื่อตีกลับ)..." value={comment} onChange={e => setComment(e.target.value)} />

                                    <button className="btn-success" style={{ width: '100%', padding: 14, marginBottom: 10, fontSize: 15 }} onClick={() => updateStatus("QUALIFIED")}>✅ คำร้องผ่านเกณฑ์</button>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button className="btn-warning" style={{ flex: 1 }} onClick={() => updateStatus("APPLICATION_EDITS_REQUIRED")}>⚠️ ส่งกลับให้แก้ไข</button>
                                        <button className="btn-danger" style={{ flex: 1 }} onClick={() => updateStatus("QUALIFICATION_FAILED")}>❌ ไม่ผ่าน</button>
                                    </div>
                                    {/* เกรดยังไม่ออก — พักคำร้องไว้ เกรดออกแล้วค่อยกลับมากดผ่าน/ไม่ผ่าน */}
                                    {selectedApp.status !== "PENDING_GRADE" && !isReviewedPass(selectedApp.status) && (
                                        <button className="btn-secondary" style={{ width: '100%', marginTop: 10, color: '#6d28d9', borderColor: '#c4b5fd' }} onClick={() => updateStatus("PENDING_GRADE")}>📊 รอพิจารณาเกรด</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{STYLES}</style>
        </div>
    );
}

const STYLES = `
    .input { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 14px; font-family: inherit; }
    .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .6); display: flex; align-items: center; justify-content: center; z-index: 999; backdrop-filter: blur(3px); }
    .modal-card-split { background: #fff; border-radius: 16px; width: 95vw; max-width: 1400px; height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
    @media (max-width: 768px) {
        .split-pane { flex-direction: column !important; overflow-y: auto !important; }
        .preview-pane { flex: 0 0 280px !important; }
    }
`;

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thRow: CSSProperties = { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" };
const th: CSSProperties = { padding: "14px 16px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#64748b" };
const tr: CSSProperties = { borderBottom: "1px solid #f1f5f9" };
const td: CSSProperties = { padding: "14px 16px", verticalAlign: "middle", fontSize: 14 };
// คำร้องที่ตรวจผ่านเกณฑ์แล้ว — ผ่านแล้วนักศึกษาเดินต่อไปขั้น T000/หนังสือ/ฝึกงาน สถานะจริงจึงเปลี่ยนไปเรื่อยๆ
const APPLICATION_OPEN_STATUSES = ["NOT_SUBMITTED", "APPLYING", "PENDING_GRADE", "APPLICATION_EDITS_REQUIRED", "QUALIFICATION_FAILED"];
function isReviewedPass(status?: string | null) {
    return !!status && !APPLICATION_OPEN_STATUSES.includes(status);
}
const reviewedBadge: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700,
    whiteSpace: "nowrap", color: "#166534", backgroundColor: "#dcfce7", border: "1px solid #16653430",
};
