import React, { useMemo, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import StatusBadge from "./StatusBadge";

// ================= TYPES =================
type Document = { id: number; name: string; path: string; type: string };
type Mentor = { id: string; firstName: string; lastName: string; email: string; phone?: string; position?: string; };
type Company = { id: string; name: string; address?: string; phone?: string; contactPerson?: string; contactPosition?: string; };
type Student = {
    id: number; studentId: string; prefix?: string; firstName: string; lastName: string;
    firstNameEn?: string; lastNameEn?: string; year?: string; major: string; curriculum?: string;
    advisorName?: string; phone?: string; email?: string; gpa: number;
    isQualified?: boolean; // ✅ เพิ่มเพื่อเช็คคุณสมบัติ
    documents: Document[];
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
};

// ================= COMPONENT =================
export default function A_CoopApplications() {
    const [apps, setApps] = useState<CoopApp[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL");

    // Modal & Preview State
    const [selectedApp, setSelectedApp] = useState<CoopApp | null>(null);
    const [comment, setComment] = useState("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<'pdf' | 'image' | null>(null);

    const token = localStorage.getItem("coop.token");

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const res = await axios.get("http://localhost:5000/api/admin/coop-applications", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.ok) setApps(res.data.applications);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { fetchApplications(); }, []);

    // ✅ Logic: หาคนที่สถานะรอตรวจ และ ผ่านคุณสมบัติ (isQualified)
    const qualifiedPendingList = useMemo(() => {
        return apps.filter(app => {
            const isPending = ["APPLYING", "WAITING_FOR_STAFF_CHECK"].includes(app.status);
            return isPending && app.student.isQualified === true;
        });
    }, [apps]);

    // ✅ ฟังก์ชันอนุมัติกลุ่ม (Bulk Approve) แบบเดียวกับ T_Requests
    const handleBulkApprove = async () => {
        const count = qualifiedPendingList.length;
        if (count === 0) return;
        if (!confirm(`⚡ ยืนยันการอนุมัติอัตโนมัติ?\n\nระบบจะอนุมัติคำร้องของนักศึกษาที่ "ผ่านคุณสมบัติ" ทั้งหมด ${count} รายการ`)) return;

        setLoading(true);
        try {
            await Promise.all(qualifiedPendingList.map(app =>
                axios.patch(`http://localhost:5000/api/admin/coop-applications/${app.id}/status`, {
                    status: "QUALIFIED",
                    comment: "อนุมัติโดยระบบ (ผ่านคุณสมบัติครบถ้วน)"
                }, { headers: { Authorization: `Bearer ${token}` } })
            ));
            alert(`ดำเนินการสำเร็จ! อนุมัติแล้ว ${count} รายการ`);
            fetchApplications();
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการอนุมัติกลุ่ม");
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (status: string) => {
        if (!selectedApp) return;
        if (status === "APPLICATION_EDITS_REQUIRED" && !comment.trim()) {
            return alert("กรุณาระบุสิ่งที่ต้องแก้ไข เพื่อให้นักศึกษาทราบ");
        }
        if (!confirm(`ยืนยันการเปลี่ยนสถานะเป็น: ${status} ?`)) return;

        try {
            await axios.patch(`http://localhost:5000/api/admin/coop-applications/${selectedApp.id}/status`, {
                status,
                comment: status === "APPLICATION_EDITS_REQUIRED" ? comment : null
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert("บันทึกสถานะเรียบร้อย");
            closeAndResetModal();
            fetchApplications();
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
        }
    };

    // ✅ แสดงเฉพาะไฟล์จาก Gateway (APPLICATION_DOC)
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
        const url = `http://localhost:5000/uploads/${doc.path}`;
        setPreviewUrl(url);
        setPreviewType(doc.path.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
    };

    const closeAndResetModal = () => {
        setSelectedApp(null);
        setComment("");
        setPreviewUrl(null);
        setPreviewType(null);
    };

    const filteredApps = apps.filter(app => {
        const matchSearch = `${app.student.studentId} ${app.student.firstName} ${app.student.lastName} ${app.company?.name || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = filterStatus === "ALL" || app.status === filterStatus;
        if (filterStatus === "PENDING") return matchSearch && ["APPLYING", "WAITING_FOR_STAFF_CHECK"].includes(app.status);
        return matchSearch && matchStatus;
    });

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER */}
            <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📂 ตรวจสอบคำร้องขอสหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>จัดการคำร้องเบื้องต้น และอนุมัติสถานะผ่านเกณฑ์</div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    {/* ✅ ปุ่ม Bulk Approve แบบเดียวกับ T_Requests */}
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
                        ⚡ อนุมัติผู้ผ่านคุณสมบัติทั้งหมด ({qualifiedPendingList.length})
                    </button>
                    <button className="btn-ghost" onClick={fetchApplications}>🔄 รีเฟรช</button>
                </div>
            </section>

            {/* FILTER & LIST */}
            <section style={card}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                    <input className="input" placeholder="🔍 ค้นหา..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1 }} />
                    <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 250 }}>
                        <option value="ALL">แสดงทุกสถานะ</option>
                        <option value="PENDING">รอดำเนินการ</option>
                        <option value="QUALIFIED">ผ่านเกณฑ์แล้ว</option>
                        <option value="APPLICATION_EDITS_REQUIRED">ส่งกลับแก้ไข</option>
                    </select>
                </div>

                <table style={table}>
                    <thead>
                        <tr style={thRow}>
                            <th style={th}>รหัสนักศึกษา / ชื่อ</th>
                            <th style={th}>คุณสมบัติ</th>
                            <th style={th}>หน่วยงาน / ตำแหน่ง</th>
                            <th style={th}>สถานะ</th>
                            <th style={{ ...th, textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredApps.map(app => (
                            <tr key={app.id} style={tr}>
                                <td style={td}>
                                    <div style={{ fontWeight: 700 }}>{app.student.studentId}</div>
                                    <div style={{ fontSize: 12, color: '#64748b' }}>{app.student.firstName} {app.student.lastName}</div>
                                </td>
                                {/* ✅ เพิ่มคอลัมน์คุณสมบัติ */}
                                <td style={td}>
                                    {app.student.isQualified ?
                                        <span style={{ color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>✅ ครบ</span> :
                                        <span style={{ color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>❌ ไม่ผ่าน</span>
                                    }
                                </td>
                                <td style={td}>
                                    <div style={{ fontWeight: 600 }}>{app.company?.name || "-"}</div>
                                    <div style={{ fontSize: 12, color: '#0ea5e9' }}>{app.jobPosition}</div>
                                </td>
                                <td style={td}>
                                    <StatusBadge status={app.status} />
                                </td>

                                <td style={{ ...td, textAlign: 'right' }}>
                                    <button className="btn" style={{ padding: '6px 16px' }} onClick={() => openReviewModal(app)}>
                                        ตรวจเอกสาร
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {/* MODAL: SPLIT SCREEN */}
            {selectedApp && (
                <div className="modal-backdrop">
                    <div className="modal-card-split">
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0 }}>พิจารณาคำร้อง: {selectedApp.student.studentId}</h3>
                            <button onClick={closeAndResetModal} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* LEFT: PREVIEW */}
                            <div style={{ flex: '0 0 60%', background: '#334155' }}>
                                {previewUrl ? (
                                    previewType === 'pdf' ? <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="p" />
                                        : <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="p" />
                                ) : <div style={{ color: 'white', textAlign: 'center', marginTop: '20%' }}>เลือกไฟล์ด้านขวาเพื่อดู</div>}
                            </div>

                            {/* RIGHT: DETAILS */}
                            <div style={{ flex: 1, padding: 20, overflowY: 'auto', background: '#f8fafc' }}>
                                {/* ✅ กรองเฉพาะ APPLICATION_DOC ในรายการไฟล์ด้านขวา */}
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>📄 เอกสารประกอบ (Gateway Only)</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {selectedApp.student.documents.filter(d => d.type === 'APPLICATION_DOC').map(doc => (
                                            <div key={doc.id} onClick={() => handlePreview(doc)}
                                                style={{
                                                    padding: 10, background: previewUrl?.includes(doc.path) ? '#e0f2fe' : '#fff',
                                                    border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13
                                                }}>
                                                📄 {doc.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Student Info Box */}
                                <div style={{ background: '#fff', padding: 15, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontWeight: 800, marginBottom: 10, borderBottom: '1px solid #eee' }}>👤 ข้อมูลผู้สมัคร</div>
                                    <div style={{ fontSize: 13, lineHeight: 2 }}>
                                        <b>ชื่อ:</b> {selectedApp.student.firstName} {selectedApp.student.lastName}<br />
                                        <b>GPA:</b> {selectedApp.student.gpa.toFixed(2)} | <b>สาขา:</b> {selectedApp.student.major}
                                    </div>
                                </div>

                                {/* Controls */}
                                <div style={{ marginTop: 30 }}>
                                    <textarea className="input" rows={3} style={{ width: '100%', marginBottom: 10 }}
                                        placeholder="ความเห็น/เหตุผลที่ตีกลับ..." value={comment} onChange={e => setComment(e.target.value)} />

                                    <button className="btn" style={{ width: '100%', background: '#10b981', padding: 12, marginBottom: 8 }} onClick={() => updateStatus("QUALIFIED")}>✅ ผ่านเกณฑ์</button>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn" style={{ flex: 1, background: '#f59e0b' }} onClick={() => updateStatus("APPLICATION_EDITS_REQUIRED")}>⚠️ ให้แก้ไข</button>
                                        <button className="btn" style={{ flex: 1, background: '#ef4444' }} onClick={() => updateStatus("REJECTED")}>❌ ไม่ผ่าน</button>
                                    </div>
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
    .btn { border-radius: 8px; border: none; font-weight: 700; color: white; background: #0ea5e9; cursor: pointer; transition: 0.2s; padding: 10px; }
    .btn:hover { opacity: 0.8; }
    .btn-ghost { padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; background: #fff; cursor: pointer; }
    .input { padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 14px; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .6); display: flex; align-items: center; justify-content: center; z-index: 999; }
    .modal-card-split { background: #fff; border-radius: 16px; width: 95vw; max-width: 1400px; height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
    .chip { padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .waiting { background: #dbeafe; color: #1d4ed8; }
    .rej { background: #fee2e2; color: #b91c1c; }
    .edit { background: #fef3c7; color: #b45309; }
    .appr { background: #dcfce7; color: #15803d; }
`;

function statusChip(s: string) {
    if (["APPLYING", "WAITING_FOR_STAFF_CHECK"].includes(s)) return <span className="chip waiting">⏳ รอตรวจ</span>;
    if (s === "REJECTED") return <span className="chip rej">❌ ไม่ผ่าน</span>;
    if (s === "APPLICATION_EDITS_REQUIRED") return <span className="chip edit">⚠️ รอแก้ไข</span>;
    if (s === "QUALIFIED") return <span className="chip appr">✅ ผ่านเกณฑ์</span>;
    return <span className="chip">{s}</span>;
}

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thRow: CSSProperties = { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" };
const th: CSSProperties = { padding: "14px 16px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#64748b" };
const tr: CSSProperties = { borderBottom: "1px solid #f1f5f9" };
const td: CSSProperties = { padding: "14px 16px", verticalAlign: "middle", fontSize: 14 };