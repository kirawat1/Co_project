import React, { useState, useEffect, useMemo } from "react";
import StatusBadge from "../components/StatusBadge";
import IssueLetterModal from "./IssueLetterModal";
import IssuePlacementLetterModal from "./IssuePlacementLetterModal";

// --- Interfaces ---
interface StudentDocument {
    id: number;
    name: string;
    path: string;
    type?: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "EDITS_REQUIRED";
}

interface StudentProfile {
    id: number;
    studentId: string;
    firstName?: string;
    lastName?: string;
    major?: string;
    documents?: StudentDocument[];
    docStatus?: "WAITING" | "WAITING_FOR_STAFF_CHECK" | "EDITS_REQUIRED" | "REQ_LETTER_ISSUED" | "DOCS_APPROVED" | "WAITING_FOR_PLACEMENT_LETTER" | "WAITING_FOR_STAFF_CHECK_LETTER" | "ACCEPTANCE_CHECKED" | "PLACEMENT_LETTER_ISSUED";
    teacherComment?: string;
    submittedAt?: string;
}

interface DocConfig {
    startDate: string;
    endDate: string;
    isOpen: boolean;
}

const IOS_BLUE = "#0074B7";

const PHASE1_DOCS = [
    { key: 'T000_SIGNED', label: '1. ใบสมัครงานสหกิจศึกษา (T000)' },
    { key: 'TRANSCRIPT', label: '2. ใบรับรองผลการศึกษา (Transcript)' },
    { key: 'CV', label: '3. ประวัติส่วนตัว (Resume/CV)' },
    { key: 'STUDENT_CARD', label: '4. สำเนาบัตรนักศึกษา' },
    { key: 'CITIZEN_CARD', label: '5. สำเนาบัตรประชาชน' },
    { key: 'PARENTAL_CONSENT', label: '6. ใบยินยอมผู้ปกครอง' }
];

const PHASE2_DOCS = [
    { key: 'ACCEPTANCE_FORM', label: '7. ใบตอบรับ (Acceptance Form)' }
];


const CAN_ISSUE_REQUEST_LETTER_STATUSES = [
    'DOCS_APPROVED',
    'REQ_LETTER_ISSUED',
    'WAITING_FOR_STAFF_CHECK_LETTER',
    'WAITING_FOR_PLACEMENT_LETTER',
    'ACCEPTANCE_CHECKED',
    'PLACEMENT_LETTER_ISSUED',
];

export default function A_DocT000() {
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [config, setConfig] = useState<DocConfig>({ startDate: "", endDate: "", isOpen: false });
    const [issueModalData, setIssueModalData] = useState<StudentProfile | null>(null);
    const [checkPhase, setCheckPhase] = useState<1 | 2>(1); // ✅ เพิ่ม: ระบุว่ากำลังตรวจเฟสไหน
    // Filters
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [placementModalData, setPlacementModalData] = useState<StudentProfile | null>(null);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewType, setPreviewType] = useState<"pdf" | "image" | "none">("none");
    const [adminComment, setAdminComment] = useState("");

    const token = localStorage.getItem("coop.token");

    // ================= LOAD DATA =================
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const resConf = await fetch("http://localhost:5000/api/admin/config/t000", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (resConf.ok) setConfig(await resConf.json());

            const resStd = await fetch("http://localhost:5000/api/admin/t000/students", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (resStd.ok) setStudents(await resStd.json());

        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const openCheckModal = (s: StudentProfile, phase: 1 | 2) => {
        setSelectedStudent(s);
        setCheckPhase(phase); // ระบุว่ากำลังตรวจเฟสไหน
        setAdminComment(s.teacherComment || "");

        // เลือกไฟล์แรกของเฟสนั้นมาแสดงอัตโนมัติ
        const targetKeys = phase === 1 ? PHASE1_DOCS.map(doc => doc.key) : PHASE2_DOCS.map(doc => doc.key);
        const firstDoc = s.documents?.find(d => targetKeys.includes(d.type || ''));

        if (firstDoc) handleSelectFile(firstDoc);
        else { setPreviewUrl(""); setPreviewType("none"); }

        setShowModal(true);
    };


    useEffect(() => { fetchAllData(); }, []);

    // ================= ACTIONS =================
    const handleSaveConfig = async () => {
        try {
            const res = await fetch("http://localhost:5000/api/admin/config/t000", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(config)
            });
            if (res.ok) alert("✅ บันทึกการตั้งค่าวันเวลาเรียบร้อยแล้ว");
        } catch (err) { alert("Save Error"); }
    };

    // Helper Update State
    const updateStudentState = (studentId: number, newData: Partial<StudentProfile>) => {
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...newData } : s));
        if (selectedStudent?.id === studentId) {
            setSelectedStudent(prev => prev ? { ...prev, ...newData } : null);
        }
    };

    // 1. ตรวจแยกรายไฟล์ + เช็ค Auto Approve
    const handleDocStatus = async (docId: number, status: "APPROVED" | "REJECTED" | "EDITS_REQUIRED") => {
        if (!selectedStudent) return;

        // Optimistic Update
        const updatedDocs = selectedStudent.documents?.map(d =>
            d.id === docId ? { ...d, status: status } : d
        ) || [];
        updateStudentState(selectedStudent.id, { documents: updatedDocs });

        try {
            await fetch(`http://localhost:5000/api/admin/doc/${docId}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status })
            });

            // Check Auto Pass
            if (checkPhase === 1) {
                const reqKeys = PHASE1_DOCS.map(r => r.key);

                const isAllPassed = reqKeys.every(key => {
                    const found = updatedDocs.find(d => d.type === key);
                    return found && found.status === 'APPROVED';
                });

                if (isAllPassed) {
                    handleSubmitReview(
                        "REQ_LETTER_ISSUED",
                        "เอกสารครบถ้วน ผ่านการตรวจสอบอัตโนมัติ"
                    );
                }
            }

            // ✅ Phase 2: ใบตอบรับ ผ่าน → หนังสือส่งตัวผ่าน (รออนุมัติ)
            if (checkPhase === 2) {
                const reqKeys = PHASE2_DOCS.map(r => r.key);

                const isAllPassed = reqKeys.every(key => {
                    const found = updatedDocs.find(d => d.type === key);
                    return found && found.status === 'APPROVED';
                });

                if (isAllPassed) {
                    handleSubmitReview(
                        "ACCEPTANCE_CHECKED",
                        "ใบตอบรับผ่านการตรวจสอบ รอเจ้าหน้าที่อนุมัติหนังสือส่งตัว"
                    );
                }
            }

            if (status === 'REJECTED' || status === 'EDITS_REQUIRED') {
                handleSubmitReview("EDITS_REQUIRED", "");
            }
        } catch (err) { console.error("Update doc error", err); }
    };

    // 2. อนุมัติทั้งหมด (One Click)
    const handleApproveAll = async () => {
        if (!selectedStudent) return;
        if (!confirm("ยืนยัน 'อนุมัติทั้งหมด' ?")) return;

        const allApprovedDocs = selectedStudent.documents?.map(d => ({ ...d, status: "APPROVED" as const })) || [];
        updateStudentState(selectedStudent.id, {
            documents: allApprovedDocs,
            docStatus: "DOCS_APPROVED"
        });
        setAdminComment("เอกสารครบถ้วน (รอออกหนังสือ)");

        try {
            // ✅ 2. ยิง API โดย backend ต้องอัปเดตเป็น DOCS_APPROVED เท่านั้น (ไม่ใช่ REQ_LETTER_ISSUED)
            // ถ้าใช้ route approve-all ต้องไปแก้ที่ backend หรือใช้ review ธรรมดาแบบนี้ก็ได้:

            // Option A: ใช้ route approve-all (ต้องไปแก้ Backend ตามข้อ 2)
            await fetch(`http://localhost:5000/api/admin/t000/approve-all`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ studentId: selectedStudent.id })
            });

            fetchAllData();
        } catch (err) { console.error("Error", err); }
    };

    // 3. บันทึกผลรวม
    const handleSubmitReview = async (status: string, autoComment = "") => {
        if (!selectedStudent) return;

        if (!autoComment && (status === "REJECTED" || status === "EDITS_REQUIRED") && !adminComment.trim()) {
            return alert("กรุณาระบุเหตุผลในช่องความเห็น");
        }

        const finalComment = autoComment || adminComment;
        updateStudentState(selectedStudent.id, { docStatus: status as any, teacherComment: finalComment });
        if (autoComment) setAdminComment(autoComment);

        try {
            await fetch("http://localhost:5000/api/admin/t000/review", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    studentId: selectedStudent.id,
                    status: status,
                    comment: finalComment
                })
            });
            if (!autoComment) {
                alert("บันทึกผลเรียบร้อย");
                setShowModal(false);
            }
        } catch (err) { console.error("Update Status Error", err); }
    };

    const handleIssueLetter = async (s: StudentProfile) => {
        if (!confirm(`ยืนยันการออกหนังสือให้ ${s.studentId}?`)) return;

        // TODO: เรียกฟังก์ชันสร้าง PDF ตรงนี้ (generateDispatchLetter)
        // await generateDispatchLetter(s);

        // ✅ อัปเดตสถานะเป็น REQ_LETTER_ISSUED (ออกหนังสือแล้ว)
        try {
            await fetch("http://localhost:5000/api/admin/t000/review", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    studentId: s.id,
                    status: "REQ_LETTER_ISSUED",
                    comment: "ออกหนังสือขอความอนุเคราะห์แล้ว"
                })
            });

            // อัปเดตหน้าจอทันที
            updateStudentState(s.id, { docStatus: "REQ_LETTER_ISSUED" });
            alert("✅ ออกหนังสือเรียบร้อย สถานะอัปเดตแล้ว");
        } catch (err) { alert("Error updating status"); }
    };

    // ================= UTILS =================
    const list = useMemo(() => {
        return students.filter(s => {
            const txt = `${s.studentId} ${s.firstName} ${s.lastName}`.toLowerCase();
            const st = s.docStatus || (s.documents && s.documents.length > 0 ? "WAITING_FOR_STAFF_CHECK" : "WAITING");
            const hasDoc = s.documents && s.documents.length > 0;
            return txt.includes(q.toLowerCase()) &&
                (statusFilter.length === 0 || statusFilter.includes(st)) &&
                hasDoc;
        });
    }, [students, q, statusFilter]);

    const handleSelectFile = (doc: StudentDocument) => {
        const url = `http://localhost:5000/uploads/${encodeURIComponent(doc.path)}`;
        setPreviewUrl(url);
        const ext = doc.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') setPreviewType("pdf");
        else if (['jpg', 'jpeg', 'png'].includes(ext || "")) setPreviewType("image");
        else setPreviewType("none");
    };

    const openModal = (s: StudentProfile) => {
        setSelectedStudent(s);
        setAdminComment(s.teacherComment || "");
        const firstDoc = s.documents?.find(d => d.type === 'T000_SIGNED') || s.documents?.[0];
        if (firstDoc) handleSelectFile(firstDoc);
        else { setPreviewUrl(""); setPreviewType("none"); }
        setShowModal(true);
    };

    const openModalAccept = (s: StudentProfile) => {
        setSelectedStudent(s);
        setAdminComment(s.teacherComment || "");
        const firstDoc = s.documents?.find(d => d.type === 'ACCEPTANCE_FORM') || s.documents?.[0];
        if (firstDoc) handleSelectFile(firstDoc);
        else { setPreviewUrl(""); setPreviewType("none"); }
        setShowModal(true);
    };

    const isSystemOpen = useMemo(() => {
        const now = new Date().getTime();
        const start = config.startDate ? new Date(config.startDate).getTime() : 0;
        const end = config.endDate ? new Date(config.endDate).getTime() : 0;
        return config.isOpen && ((!start && !end) || (now >= start && now <= end));
    }, [config]);

    const activeDocs = checkPhase === 1 ? PHASE1_DOCS : PHASE2_DOCS;
    // Render Doc Group
    const renderDocGroup = (title: string, docs: StudentDocument[]) => {
        if (!docs || docs.length === 0) {
            return (
                <div key={title} style={{
                    background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 8, padding: 12, opacity: 0.7
                }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
                        {title}
                    </div>
                    <div style={{ fontSize: 13, color: '#ef4444', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ⚠️ ยังไม่อัปโหลดเอกสาร
                    </div>
                </div>
            );
        }

        return (
            <div key={title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    {title} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({docs.length})</span>
                </div>
                {docs.map(doc => {
                    const isActive = previewUrl.includes(encodeURIComponent(doc.path));
                    let statusColor = '#cbd5e1';
                    if (doc.status === 'APPROVED') statusColor = '#22c55e';
                    if (doc.status === 'REJECTED') statusColor = '#ef4444';
                    if (doc.status === 'EDITS_REQUIRED') statusColor = '#f59e0b';

                    return (
                        <div key={doc.id} onClick={() => handleSelectFile(doc)}
                            style={{
                                padding: 12, borderBottom: '1px solid #eee', cursor: 'pointer',
                                background: isActive ? '#f0f9ff' : 'white',
                                borderLeft: `4px solid ${statusColor}`,
                                transition: '0.1s'
                            }}>
                            <div style={{ fontSize: 13, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{doc.name.endsWith('.pdf') ? '🔴' : '🔵'}</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>{doc.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 5 }}>
                                <button className={`action-btn edit ${doc.status === 'EDITS_REQUIRED' ? 'active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); handleDocStatus(doc.id, "EDITS_REQUIRED"); }}>
                                    🛠️ แก้ไข
                                </button>
                                <button className={`action-btn fail ${doc.status === 'REJECTED' ? 'active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); handleDocStatus(doc.id, "REJECTED"); }}>
                                    ❌ ไม่ผ่าน
                                </button>
                                <button className={`action-btn pass ${doc.status === 'APPROVED' ? 'active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); handleDocStatus(doc.id, "APPROVED"); }}>
                                    ✅ ผ่าน
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div style={{ padding: 28, marginLeft: 35 }}>

            {/* 1. CONFIG SECTION */}
            <section className="card" style={{ marginBottom: 20, borderLeft: `5px solid ${isSystemOpen ? '#10b981' : '#ef4444'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
                    <div>
                        <h3 style={{ margin: 0 }}>⚙️ จัดการเอกสารสมัคร (T000)</h3>
                        <div style={{ fontSize: 13, marginTop: 4, color: isSystemOpen ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {isSystemOpen ? "🟢 สถานะ: เปิดรับเอกสาร" : "🔴 สถานะ: ปิดรับเอกสาร"}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div>
                            <label style={lbl}>วันเปิดรับ</label>
                            <input type="date" className="input" value={config.startDate} onChange={e => setConfig({ ...config, startDate: e.target.value })} />
                        </div>
                        <div>
                            <label style={lbl}>วันปิดรับ</label>
                            <input type="date" className="input" value={config.endDate} onChange={e => setConfig({ ...config, endDate: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: 38, gap: 15 }}>
                            <label style={{ fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                                <input type="checkbox" checked={config.isOpen} onChange={e => setConfig({ ...config, isOpen: e.target.checked })} style={{ width: 16, height: 16 }} />
                                เปิดระบบ
                            </label>
                            <button className="btn" style={{ background: IOS_BLUE, color: 'white' }} onClick={handleSaveConfig}>บันทึก</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. TABLE LIST */}
            <section className="card">
                <h3 style={{ margin: "0 0 16px 0" }}>รายการส่งเอกสาร ({list.length})</h3>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                    <input className="input" placeholder="ค้นหา..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 250 }} />
                    {["WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED", "DOCS_APPROVED", "REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"].map(st => (
                        <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                            <input type="checkbox" checked={statusFilter.includes(st)} onChange={e => setStatusFilter(p => e.target.checked ? [...p, st] : p.filter(x => x !== st))} />
                            {statusChip(st)}
                        </label>
                    ))}
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                        <thead>
                            <tr style={{ color: '#64748b', fontSize: 13, textAlign: 'left' }}>
                                <th style={{ padding: 10 }}>รหัสนักศึกษา</th>
                                <th style={{ padding: 10 }}>ชื่อ-สกุล</th>
                                <th style={{ padding: 10 }}>ไฟล์</th>
                                <th style={{ padding: 10 }}>วันที่ส่ง</th>
                                <th style={{ padding: 10 }}>สถานะ</th>
                                <th style={{ padding: 10 }}>ตรวจสอบT000</th>
                                <th style={{ padding: 10 }}>ออกหนังสือขอความอนุเคราะห์</th>
                                <th style={{ padding: 10 }}>ตรวจสอบใบตอบรับ</th>
                                <th style={{ padding: 10 }}>ออกหนังสือส่งตัว</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map(s => (
                                <tr key={s.id} style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
                                    <td style={td}>{s.studentId}</td>
                                    <td style={td}>{s.firstName} {s.lastName}</td>
                                    <td style={td}>{s.documents?.length}</td>
                                    <td style={td}>{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('th-TH') : "-"}</td>
                                    <td style={td}><StatusBadge status={s.docStatus} /></td>
                                    <td style={td}>
                                        <button
                                            className="btn"
                                            style={{ background: IOS_BLUE, color: 'white', fontSize: 12 }}
                                            onClick={() => openCheckModal(s, 1)}
                                        >
                                            🔍 ตรวจสอบ T000
                                        </button>
                                    </td>
                                    <td style={td}>
                                        {/* ปุ่มออกหนังสือ: แสดงเมื่อเอกสารผ่านแล้ว (DOCS_APPROVED) หรือ ออกไปแล้วแต่อยากออกซ้ำ */}
                                        {CAN_ISSUE_REQUEST_LETTER_STATUSES.includes(s.docStatus || '') && (
                                            <button
                                                className="btn"
                                                style={{
                                                    // ถ้ายังไม่ออกหนังสือให้เป็นสีเขียว ถ้าออกแล้วเป็นสีเทาๆ
                                                    background: s.docStatus === 'DOCS_APPROVED' ? '#16a34a' : '#64748b',
                                                    color: 'white', fontSize: 12
                                                }}
                                                onClick={() => setIssueModalData(s)}
                                            >
                                                {s.docStatus === 'DOCS_APPROVED' ? '📄 ออกหนังสือขอความอนุเคราะห์' : '🖨️ พิมพ์ซ้ำ'}
                                            </button>
                                        )}
                                    </td>
                                    <td style={td}>
                                        <button
                                            className="btn"
                                            style={{ background: '#3b82f6', color: 'white', fontSize: 12 }}
                                            onClick={() => openCheckModal(s, 2)}
                                        >
                                            🔍 ตรวจสอบใบตอบรับ
                                        </button>
                                    </td>
                                    <td style={td}>
                                        {/* ปุ่มออกหนังสือส่งตัว: แสดงเมื่อใบตอบรับผ่านการตรวจสอบแล้ว */}
                                        {(s.docStatus === 'ACCEPTANCE_CHECKED' ||
                                            s.docStatus === 'PLACEMENT_LETTER_ISSUED') && (
                                                <button
                                                    className="btn"
                                                    style={{
                                                        background:
                                                            s.docStatus === 'ACCEPTANCE_CHECKED'
                                                                ? '#0ea5e9'
                                                                : '#64748b',
                                                        color: 'white',
                                                        fontSize: 12
                                                    }}
                                                    onClick={() => setPlacementModalData(s)}
                                                >
                                                    {s.docStatus === 'ACCEPTANCE_CHECKED'
                                                        ? '📄 ออกหนังสือส่งตัว'
                                                        : '🖨️ พิมพ์ซ้ำ'}
                                                </button>
                                            )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 3. MODAL REVIEW - FIXED LAYOUT */}
            {issueModalData && (
                <IssueLetterModal
                    student={issueModalData}
                    onClose={() => setIssueModalData(null)}
                    onSuccess={() => {
                        setIssueModalData(null);
                        fetchAllData(); // โหลดข้อมูลใหม่เพื่ออัปเดตสถานะ
                    }}
                />
            )}

            {placementModalData && (
                <IssuePlacementLetterModal
                    student={placementModalData}
                    onClose={() => setPlacementModalData(null)}
                    onSuccess={() => {
                        setPlacementModalData(null);
                        fetchAllData(); // รีเฟรชสถานะเป็น PLACEMENT_LETTER_ISSUED
                    }}
                />
            )}

            {showModal && selectedStudent && (
                <div className="modal-backdrop">
                    {/* ✅ Modal Card: Fixed Size, Flex Column */}
                    <div className="modal-card">

                        {/* ✅ Header: Flex Shrink 0 (ไม่ยืดหด) */}
                        <div style={{
                            flexShrink: 0,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, color: '#1e293b' }}>
                                    {checkPhase === 1 ? 'ตรวจเอกสาร T000' : 'ตรวจสอบใบตอบรับ'}
                                </h3>
                                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                                    {selectedStudent.studentId} - {selectedStudent.firstName} {selectedStudent.lastName}
                                </div>
                            </div>
                            {/* ✅ Close Button: ชิดขวาแน่นอนด้วย flex */}
                            <button onClick={() => setShowModal(false)}
                                style={{
                                    border: 'none', background: '#fee2e2', color: '#dc2626',
                                    width: 32, height: 32, borderRadius: '50%', fontSize: 18,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                &times;
                            </button>
                        </div>

                        {/* ✅ Body Content: Flex 1 (เต็มพื้นที่ที่เหลือ) & Overflow Hidden */}
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                            {/* 🟢 LEFT: PDF PREVIEW (65%) */}
                            <div style={{ flex: '0 0 65%', background: '#334155', position: 'relative', overflow: 'hidden' }}>
                                {previewType === 'pdf' ? (
                                    // ✅ Iframe ใช้ absolute เต็มพื้นที่ parent
                                    <iframe src={previewUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} title="preview" />
                                ) : previewType === 'image' ? (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="preview" />
                                    </div>
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                        <span style={{ fontSize: 48, marginBottom: 10 }}>📄</span>
                                        <span>เลือกเอกสารทางขวาเพื่อดูตัวอย่าง</span>
                                    </div>
                                )}
                            </div>

                            {/* 🟢 RIGHT: CONTROL PANEL (35%) */}
                            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', background: '#fff', borderLeft: '1px solid #e2e8f0', minWidth: 320, overflow: 'hidden' }}>

                                {/* Actions Header */}
                                <div
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid #eee',
                                        background: '#f8fafc',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexShrink: 0
                                    }}
                                >
                                    <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
                                        รายการเอกสาร
                                    </div>

                                    {/* ✅ แสดงปุ่มนี้เฉพาะ Phase 1 เท่านั้น */}
                                    {checkPhase === 1 && (
                                        <button
                                            onClick={handleApproveAll}
                                            style={{
                                                fontSize: 12,
                                                background: '#10b981',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: 6,
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                                            }}
                                        >
                                            ✅ อนุมัติทั้งหมด (ผ่าน)
                                        </button>
                                    )}
                                </div>

                                {/* Scrollable List */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {activeDocs.map((req) => {
                                            const docs =
                                                selectedStudent.documents?.filter(d => d.type === req.key) || [];
                                            return renderDocGroup(req.label, docs);
                                        })}
                                    </div>
                                </div>


                                {/* Footer */}
                                <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
                                    <textarea className="input" rows={2} style={{ width: '100%', marginBottom: 8, fontSize: 13 }}
                                        placeholder="ระบุเหตุผล (กรณีแก้ไข/ไม่ผ่าน)"
                                        value={adminComment} onChange={e => setAdminComment(e.target.value)}
                                    />
                                    <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
                                        * หากเอกสารครบถ้วน ระบบจะเปลี่ยนสถานะเป็น "รอออกหนังสือ" อัตโนมัติ
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .card { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; }
        .input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: inherit; box-sizing: border-box; }
        .btn { padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 14px; transition: 0.2s; }
        .btn:hover { opacity: 0.9; }
        
        .modal-backdrop { 
            position: fixed; inset: 0; background: rgba(0,0,0,0.75); 
            display: flex; justify-content: center; alignItems: center; z-index: 9999; 
            backdrop-filter: blur(4px); 
        }
        .modal-card { 
            background: #fff; 
            border-radius: 12px; 
            width: 95vw; 
            height: 90vh; /* Fixed Height */
            max-width: 1400px; 
            display: flex; 
            flex-direction: column; /* Flex Col for layout */
            overflow: hidden; /* Prevent body overflow */
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); 
        }
        
        .chip { padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: bold; display: inline-block; white-space: nowrap; }
    
    .chip.waiting { background: #f1f5f9; color: #64748b; } /* เทา */
    .chip.appr { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; } /* เขียว (ผ่าน) */
    .chip.done { background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; } /* ม่วง */

    .chip.edit { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; } /* ส้ม */
    .chip.WAITING_FOR_PLACEMENT_LETTER { background: #ecfeff; color: #0891b2; border: 1px solid #0891b2;} /* เทา */
    .chip.WAITING_FOR_STAFF_CHECK_LETTER { background: #fffbeb; color: #d97706; border: 1px solid #d97706; } /* เทา */
    .chip.ACCEPTANCE_CHECKED { background: #d1fae5; color: #059669; border: 1px solid #059669; } /* เขียว (ผ่าน) */
    .chip.place { background: #d1fae5; color: #047857; border: 1px solid #047857; } /* ฟ้า */











    .chip.rej { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; } /* แดง */
        .action-btn { flex: 1; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 12px; font-weight: 600; color: #475569; transition: 0.1s; }
        .action-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
        .action-btn.edit.active { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
        .action-btn.fail.active { background: #fef2f2; color: #b91c1c; border-color: #fca5a5; }
        .action-btn.pass.active { background: #dcfce7; color: #15803d; border-color: #86efac; }
      `}</style>
        </div>
    );
}

const td: React.CSSProperties = { padding: "12px 10px", borderTop: "1px solid #f3f4f6", fontSize: 14 };
const lbl: React.CSSProperties = { fontSize: 12, display: 'block', color: '#64748b', marginBottom: 4 };

function statusChip(status?: string) {
    let s = (status || "WAITING");
    let label = "รอเอกสาร";
    let cls = "waiting";

    if (s === "WAITING_FOR_STAFF_CHECK" || s === "PENDING") { cls = "waiting"; label = "รอตรวจสอบ"; }
    else if (s === "REJECTED") { cls = "rej"; label = "❌ ไม่ผ่าน"; }
    else if (s === "EDITS_REQUIRED") { cls = "edit"; label = "⚠️ รอแก้ไข"; }
    else if (s === "DOCS_APPROVED") { cls = "appr"; label = "✅ ผ่าน (รอออกหนังสือส่งตัว)"; } // สีเขียว
    else if (s === "REQ_LETTER_ISSUED") { cls = "done"; label = "🚚 ออกหนังสือแล้ว"; } // สีม่วง
    else if (s === "WAITING_FOR_PLACEMENT_LETTER") { cls = "WAITING_FOR_PLACEMENT_LETTER"; label = "🏢 รอใบตอบรับ"; }
    else if (s === "WAITING_FOR_STAFF_CHECK_LETTER") { cls = "WAITING_FOR_STAFF_CHECK_LETTER"; label = "🕵️รอตรวจใบตอบรับ"; }
    else if (s === "ACCEPTANCE_CHECKED") { cls = "ACCEPTANCE_CHECKED"; label = "✨ ใบตอบรับผ่าน"; } // สีเขียว
    else if (s === "PLACEMENT_LETTER_ISSUED") { cls = "place"; label = "🏁 ออกหนังสือส่งตัวแล้ว"; } // สีม่วง


    return <span className={`chip ${cls}`}>{label}</span>;
}