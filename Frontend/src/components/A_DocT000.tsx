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
    status: "PENDING" | "APPROVED" | "REJECTED" | "EDITS_REQUIRED" | "WAITING";
}

interface StudentProfile {
    id: number;
    studentId: string;
    firstName?: string;
    lastName?: string;
    major?: string;
    documents?: StudentDocument[];
    docStatus?: "WAITING" | "WAITING_FOR_STAFF_CHECK" | "EDITS_REQUIRED" | "REQ_LETTER_ISSUED" | "DOCS_APPROVED" | "WAITING_FOR_PLACEMENT_LETTER" | "WAITING_FOR_STAFF_CHECK_LETTER" | "ACCEPTANCE_CHECKED" | "PLACEMENT_LETTER_ISSUED" | "QUALIFIED";
    teacherComment?: string;
    submittedAt?: string;
    coopPeriodId?: number; // ไว้กรองรอบปีการศึกษา
    coop?: {
        coopPeriodId?: number; // เผื่อกรณี Backend ซ้อนมาใน coop
        company?: { name: string };
    }
}

interface DocConfig {
    startDate: string;
    endDate: string;
    isOpen: boolean;
}

interface DocRequirement {
    id: number;
    docKey: string;
    title: string;
    isRequired: boolean;
}

// 🟢 Types สำหรับการเรียงลำดับ (Sorting)
type SortKey = 'studentId' | 'name' | 'filesCount' | 'submittedAt' | 'docStatus';
type SortDirection = 'asc' | 'desc';

const IOS_BLUE = "#0074B7";

const CAN_ISSUE_REQUEST_LETTER_STATUSES = [
    'DOCS_APPROVED',
    'REQ_LETTER_ISSUED',
    'WAITING_FOR_STAFF_CHECK_LETTER',
    'WAITING_FOR_PLACEMENT_LETTER',
    'ACCEPTANCE_CHECKED',
    'PLACEMENT_LETTER_ISSUED',
];

const isMatch = (docType: string, reqKey: string) => {
    if (docType === reqKey) return true;
    if (reqKey === 'CP-T000' && docType === 'T000_SIGNED') return true;
    if (reqKey === 'CP-TRANSCRIPT' && docType === 'TRANSCRIPT') return true;
    if (reqKey === 'CP-CV' && docType === 'CV') return true;
    if (reqKey === 'CP-STUDENT_CARD' && docType === 'STUDENT_CARD') return true;
    if (reqKey === 'CP-CITIZEN_CARD' && docType === 'CITIZEN_CARD') return true;
    if (reqKey === 'CP-PARENTAL_CONSENT' && docType === 'PARENTAL_CONSENT') return true;
    if (reqKey === 'CP-ACCEPTANCE' && docType === 'ACCEPTANCE_FORM') return true;
    return false;
};

export default function A_DocT000() {
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [config, setConfig] = useState<DocConfig>({ startDate: "", endDate: "", isOpen: false });

    const [reqDocs, setReqDocs] = useState<DocRequirement[]>([]);

    // State ปีการศึกษา
    const [coopPeriods, setCoopPeriods] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

    const [issueModalData, setIssueModalData] = useState<StudentProfile | null>(null);
    const [checkPhase, setCheckPhase] = useState<1 | 2>(1);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [placementModalData, setPlacementModalData] = useState<StudentProfile | null>(null);

    const [showModal, setShowModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewType, setPreviewType] = useState<"pdf" | "image" | "none">("none");
    const [adminComment, setAdminComment] = useState("");

    // 🟢 State สำหรับการเรียงลำดับ (Sorting)
    const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const token = localStorage.getItem("coop.token");

    const phase1Docs = useMemo(() => {
        return reqDocs
            .filter(r => r.docKey !== 'CP-ACCEPTANCE')
            .map(r => ({ key: r.docKey, label: r.title, isRequired: r.isRequired }));
    }, [reqDocs]);

    const phase2Docs = useMemo(() => {
        const hasAcceptance = reqDocs.find(r => r.docKey === 'CP-ACCEPTANCE');
        if (hasAcceptance) {
            return [{ key: hasAcceptance.docKey, label: hasAcceptance.title, isRequired: hasAcceptance.isRequired }];
        }
        return [{ key: 'CP-ACCEPTANCE', label: 'ใบตอบรับ (Acceptance Form)', isRequired: true }];
    }, [reqDocs]);

    // ================= LOAD DATA =================
    const fetchAllData = async () => {
        setLoading(true);
        try {
            // 1. ดึงตั้งค่าเวลา
            const resConf = await fetch("http://localhost:5000/api/admin/config/t000", { headers: { Authorization: `Bearer ${token}` } });
            if (resConf.ok) setConfig(await resConf.json());

            // 2. ดึงหัวข้อเอกสาร
            const resReq = await fetch("http://localhost:5000/api/admin/doc-requirements", { headers: { Authorization: `Bearer ${token}` } });
            if (resReq.ok) {
                const reqData = await resReq.json();
                if (reqData.ok) setReqDocs(reqData.requirements);
            }

            // 3. ดึงรายชื่อนักศึกษา
            const resStd = await fetch("http://localhost:5000/api/admin/t000/students", { headers: { Authorization: `Bearer ${token}` } });
            if (resStd.ok) setStudents(await resStd.json());

            // 4. ดึงข้อมูลปีการศึกษา 
            const resPeriods = await fetch("http://localhost:5000/api/admin/coop-periods/all", { headers: { Authorization: `Bearer ${token}` } });
            if (resPeriods.ok) {
                const periodsData = await resPeriods.json();
                if (periodsData.ok && periodsData.periods) setCoopPeriods(periodsData.periods);
            }

        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const openCheckModal = (s: StudentProfile, phase: 1 | 2) => {
        setSelectedStudent(s);
        setCheckPhase(phase);
        setAdminComment(s.teacherComment || "");

        const targetKeys = phase === 1 ? phase1Docs.map(doc => doc.key) : phase2Docs.map(doc => doc.key);
        const firstDoc = s.documents?.find(d => targetKeys.some(reqKey => isMatch(d.type || '', reqKey)));

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

    const updateStudentState = (studentId: number, newData: Partial<StudentProfile>) => {
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...newData } : s));
        if (selectedStudent?.id === studentId) {
            setSelectedStudent(prev => prev ? { ...prev, ...newData } : null);
        }
    };

    const handleDocStatus = async (docId: number, status: "APPROVED" | "REJECTED" | "EDITS_REQUIRED") => {
        if (!selectedStudent) return;

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

            if (checkPhase === 1) {
                const reqKeys = phase1Docs.filter(d => d.isRequired).map(r => r.key);
                if (reqKeys.length > 0) {
                    const isAllPassed = reqKeys.every(key => {
                        const found = updatedDocs.find(d => isMatch(d.type || '', key));
                        return found && found.status === 'APPROVED';
                    });
                    if (isAllPassed) handleSubmitReview("REQ_LETTER_ISSUED", "เอกสารครบถ้วน ผ่านการตรวจสอบอัตโนมัติ");
                }
            }

            if (checkPhase === 2) {
                const reqKeys = phase2Docs.filter(d => d.isRequired).map(r => r.key);
                if (reqKeys.length > 0) {
                    const isAllPassed = reqKeys.every(key => {
                        const found = updatedDocs.find(d => isMatch(d.type || '', key));
                        return found && found.status === 'APPROVED';
                    });
                    if (isAllPassed) handleSubmitReview("ACCEPTANCE_CHECKED", "ใบตอบรับผ่านการตรวจสอบ รอเจ้าหน้าที่อนุมัติหนังสือส่งตัว");
                }
            }

            if (status === 'REJECTED' || status === 'EDITS_REQUIRED') {
                handleSubmitReview("EDITS_REQUIRED", "");
            }
        } catch (err) { console.error("Update doc error", err); }
    };

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
            await fetch(`http://localhost:5000/api/admin/t000/approve-all`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ studentId: selectedStudent.id })
            });
            fetchAllData();
        } catch (err) { console.error("Error", err); }
    };

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

    const handleSelectFile = (doc: StudentDocument) => {
        const url = `http://localhost:5000/uploads/${encodeURIComponent(doc.path)}`;
        setPreviewUrl(url);
        const ext = doc.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') setPreviewType("pdf");
        else if (['jpg', 'jpeg', 'png'].includes(ext || "")) setPreviewType("image");
        else setPreviewType("none");
    };

    // 🟢 ฟังก์ชันจัดการคลิก Header เพื่อเรียงลำดับ
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    // ================= UTILS / FILTER / SORT =================
    const list = useMemo(() => {
        // 1. กรองข้อมูล (Filter)
        let filtered = students.filter(s => {
            const txt = `${s.studentId} ${s.firstName} ${s.lastName}`.toLowerCase();
            const st = s.docStatus || (s.documents && s.documents.length > 0 ? "WAITING_FOR_STAFF_CHECK" : "WAITING");
            const hasDoc = s.documents && s.documents.length > 0;

            // 🟢 แก้ให้ดัก coopPeriodId ได้ชัวร์ๆ
            const pId = String(s.coopPeriodId || s.coop?.coopPeriodId || "");
            const matchPeriod = selectedPeriod === "all" || pId === selectedPeriod;

            // ถ้าไม่มีไฟล์เลย จะไม่โชว์ ยกเว้นว่ามีสถานะ QUALIFIED (ผ่านคุณสมบัติแล้วรอเอกสาร)
            const shouldShow = hasDoc || st === "QUALIFIED";

            return txt.includes(q.toLowerCase()) &&
                (statusFilter.length === 0 || statusFilter.includes(st)) &&
                shouldShow && matchPeriod;
        });

        // 2. เรียงลำดับข้อมูล (Sort)
        filtered.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            switch (sortKey) {
                case 'studentId':
                    valA = a.studentId; valB = b.studentId; break;
                case 'name':
                    valA = a.firstName; valB = b.firstName; break;
                case 'filesCount':
                    valA = a.documents?.length || 0; valB = b.documents?.length || 0; break;
                case 'submittedAt':
                    valA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                    valB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                    break;
                case 'docStatus':
                    valA = a.docStatus || ''; valB = b.docStatus || ''; break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [students, q, statusFilter, selectedPeriod, sortKey, sortDirection]);

    const isSystemOpen = useMemo(() => {
        const now = new Date().getTime();
        const start = config.startDate ? new Date(config.startDate).getTime() : 0;
        const end = config.endDate ? new Date(config.endDate).getTime() : 0;
        return config.isOpen && ((!start && !end) || (now >= start && now <= end));
    }, [config]);

    const activeDocs = checkPhase === 1 ? phase1Docs : phase2Docs;

    // UI HELPER: แสดงลูกศรเรียงลำดับ
    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <span style={{ color: '#cbd5e1', marginLeft: 4 }}>↕</span>;
        return <span style={{ color: '#0ea5e9', marginLeft: 4 }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    const renderDocGroup = (title: string, isRequired: boolean, docs: StudentDocument[]) => {
        const displayTitle = isRequired ? `${title} *` : title;

        if (!docs || docs.length === 0) {
            return (
                <div key={title} style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 8, padding: 12, opacity: 0.7 }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{displayTitle}</div>
                    <div style={{ fontSize: 13, color: '#ef4444', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ⚠️ ยังไม่อัปโหลดเอกสาร
                    </div>
                </div>
            );
        }

        return (
            <div key={title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#475569' }}>
                    {displayTitle} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({docs.length})</span>
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
                        <div><label style={lbl}>วันเปิดรับ</label><input type="date" className="input" value={config.startDate} onChange={e => setConfig({ ...config, startDate: e.target.value })} /></div>
                        <div><label style={lbl}>วันปิดรับ</label><input type="date" className="input" value={config.endDate} onChange={e => setConfig({ ...config, endDate: e.target.value })} /></div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0 }}>รายการส่งเอกสาร ({list.length})</h3>
                    <button className="btn" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }} onClick={fetchAllData} disabled={loading}>
                        {loading ? '⏳ กำลังรีเฟรช...' : '🔄 รีเฟรชข้อมูล'}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                    <input className="input" placeholder="ค้นหา รหัสนักศึกษา / ชื่อ..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 250 }} />

                    {/* Dropdown เลือกปีการศึกษา */}
                    <select className="input" style={{ width: 'auto', background: '#f8fafc' }} value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
                        <option value="all">📚 ทุกปีการศึกษา</option>
                        {coopPeriods.map(p => (
                            <option key={p.id} value={p.id}>เทอม {p.semester} / {p.academicYear}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {/* 🟢 เพิ่ม QUALIFIED เข้าไปในตัวกรอง */}
                    {["QUALIFIED", "WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED", "DOCS_APPROVED", "REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"].map(st => (
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
                                {/* 🟢 เพิ่ม onClick เพื่อเรียงลำดับ */}
                                <th style={{ ...th, cursor: 'pointer' }} onClick={() => handleSort('studentId')}>รหัสนักศึกษา <SortIcon columnKey="studentId" /></th>
                                <th style={{ ...th, cursor: 'pointer' }} onClick={() => handleSort('name')}>ชื่อ-สกุล <SortIcon columnKey="name" /></th>
                                <th style={{ ...th, cursor: 'pointer' }} onClick={() => handleSort('filesCount')}>ไฟล์ <SortIcon columnKey="filesCount" /></th>
                                <th style={{ ...th, cursor: 'pointer' }} onClick={() => handleSort('submittedAt')}>วันที่ส่ง <SortIcon columnKey="submittedAt" /></th>
                                <th style={{ ...th, cursor: 'pointer' }} onClick={() => handleSort('docStatus')}>สถานะ <SortIcon columnKey="docStatus" /></th>
                                <th style={th}>ตรวจสอบT000</th>
                                <th style={th}>ออกหนังสือขอความอนุเคราะห์</th>
                                <th style={th}>ตรวจสอบใบตอบรับ</th>
                                <th style={th}>ออกหนังสือส่งตัว</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map(s => (
                                <tr key={s.id} style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
                                    <td style={td}>{s.studentId}</td>
                                    <td style={td}>{s.firstName} {s.lastName}</td>
                                    <td style={td}>{s.documents?.length || 0}</td>
                                    <td style={td}>{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('th-TH') : "-"}</td>
                                    <td style={td}><StatusBadge status={s.docStatus} /></td>
                                    <td style={td}>
                                        <button className="btn" style={{ background: IOS_BLUE, color: 'white', fontSize: 12 }} onClick={() => openCheckModal(s, 1)}>
                                            🔍 ตรวจสอบ T000
                                        </button>
                                    </td>
                                    <td style={td}>
                                        {CAN_ISSUE_REQUEST_LETTER_STATUSES.includes(s.docStatus || '') && (
                                            <button className="btn" style={{ background: s.docStatus === 'DOCS_APPROVED' ? '#16a34a' : '#64748b', color: 'white', fontSize: 12 }} onClick={() => setIssueModalData(s)}>
                                                {s.docStatus === 'DOCS_APPROVED' ? '📄 ออกหนังสือขอความอนุเคราะห์' : '🖨️ พิมพ์ซ้ำ'}
                                            </button>
                                        )}
                                    </td>
                                    <td style={td}>
                                        <button className="btn" style={{ background: '#3b82f6', color: 'white', fontSize: 12 }} onClick={() => openCheckModal(s, 2)}>
                                            🔍 ตรวจสอบใบตอบรับ
                                        </button>
                                    </td>
                                    <td style={td}>
                                        {(s.docStatus === 'ACCEPTANCE_CHECKED' || s.docStatus === 'PLACEMENT_LETTER_ISSUED') && (
                                            <button className="btn" style={{ background: s.docStatus === 'ACCEPTANCE_CHECKED' ? '#0ea5e9' : '#64748b', color: 'white', fontSize: 12 }} onClick={() => setPlacementModalData(s)}>
                                                {s.docStatus === 'ACCEPTANCE_CHECKED' ? '📄 ออกหนังสือส่งตัว' : '🖨️ พิมพ์ซ้ำ'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {list.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>ไม่มีข้อมูลที่ตรงกับเงื่อนไขการค้นหา</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 3. MODALS */}
            {issueModalData && (
                <IssueLetterModal student={issueModalData} onClose={() => setIssueModalData(null)} onSuccess={() => { setIssueModalData(null); fetchAllData(); }} />
            )}

            {placementModalData && (
                <IssuePlacementLetterModal student={placementModalData} onClose={() => setPlacementModalData(null)} onSuccess={() => { setPlacementModalData(null); fetchAllData(); }} />
            )}

            {showModal && selectedStudent && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, color: '#1e293b' }}>{checkPhase === 1 ? 'ตรวจเอกสาร T000' : 'ตรวจสอบใบตอบรับ'}</h3>
                                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{selectedStudent.studentId} - {selectedStudent.firstName} {selectedStudent.lastName}</div>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
                        </div>

                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* LEFT: PDF PREVIEW */}
                            <div style={{ flex: '0 0 65%', background: '#334155', position: 'relative', overflow: 'hidden' }}>
                                {previewType === 'pdf' ? (
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

                            {/* RIGHT: CONTROL PANEL */}
                            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', background: '#fff', borderLeft: '1px solid #e2e8f0', minWidth: 320, overflow: 'hidden' }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                    <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>รายการเอกสาร</div>
                                    {checkPhase === 1 && (
                                        <button onClick={handleApproveAll} style={{ fontSize: 12, background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}>
                                            ✅ อนุมัติทั้งหมด
                                        </button>
                                    )}
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {activeDocs.map((req) => {
                                            const docs = selectedStudent.documents?.filter(d => isMatch(d.type || '', req.key)) || [];
                                            return renderDocGroup(req.label, req.isRequired, docs);
                                        })}
                                    </div>
                                </div>

                                <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
                                    <textarea className="input" rows={2} style={{ width: '100%', marginBottom: 8, fontSize: 13 }}
                                        placeholder="ระบุเหตุผล (กรณีแก้ไข/ไม่ผ่าน)"
                                        value={adminComment} onChange={e => setAdminComment(e.target.value)}
                                    />
                                    <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
                                        * หากเอกสารบังคับครบถ้วน ระบบจะเปลี่ยนสถานะเป็น "รอออกหนังสือ" อัตโนมัติ
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
                
                .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; justify-content: center; alignItems: center; z-index: 9999; backdrop-filter: blur(4px); }
                .modal-card { background: #fff; border-radius: 12px; width: 95vw; height: 90vh; max-width: 1400px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
                
                .chip { padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: bold; display: inline-block; white-space: nowrap; }
                .chip.waiting { background: #f1f5f9; color: #64748b; } 
                .chip.appr { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; } 
                .chip.done { background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; } 
                .chip.edit { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; } 
                .chip.WAITING_FOR_PLACEMENT_LETTER { background: #ecfeff; color: #0891b2; border: 1px solid #0891b2;} 
                .chip.WAITING_FOR_STAFF_CHECK_LETTER { background: #fffbeb; color: #d97706; border: 1px solid #d97706; } 
                .chip.ACCEPTANCE_CHECKED { background: #d1fae5; color: #059669; border: 1px solid #059669; } 
                .chip.place { background: #d1fae5; color: #047857; border: 1px solid #047857; } 
                .chip.rej { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; } 
                .chip.QUALIFIED { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; } 

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
const th: React.CSSProperties = { padding: "10px", userSelect: 'none' };
const lbl: React.CSSProperties = { fontSize: 12, display: 'block', color: '#64748b', marginBottom: 4 };

function statusChip(status?: string) {
    let s = (status || "WAITING");
    let label = "รอเอกสาร";
    let cls = "waiting";

    if (s === "QUALIFIED") { cls = "QUALIFIED"; label = "✅ ผ่านคุณสมบัติ (รอเอกสาร)"; }
    else if (s === "WAITING_FOR_STAFF_CHECK" || s === "PENDING") { cls = "waiting"; label = "รอตรวจสอบ"; }
    else if (s === "REJECTED") { cls = "rej"; label = "❌ ไม่ผ่าน"; }
    else if (s === "EDITS_REQUIRED") { cls = "edit"; label = "⚠️ รอแก้ไข"; }
    else if (s === "DOCS_APPROVED") { cls = "appr"; label = "✅ ผ่าน (รอออกหนังสือ)"; }
    else if (s === "REQ_LETTER_ISSUED") { cls = "done"; label = "🚚 ออกหนังสือแล้ว"; }
    else if (s === "WAITING_FOR_PLACEMENT_LETTER") { cls = "WAITING_FOR_PLACEMENT_LETTER"; label = "🏢 รอใบตอบรับ"; }
    else if (s === "WAITING_FOR_STAFF_CHECK_LETTER") { cls = "WAITING_FOR_STAFF_CHECK_LETTER"; label = "🕵️รอตรวจตอบรับ"; }
    else if (s === "ACCEPTANCE_CHECKED") { cls = "ACCEPTANCE_CHECKED"; label = "✨ ตอบรับผ่าน"; }
    else if (s === "PLACEMENT_LETTER_ISSUED") { cls = "place"; label = "🏁 ออกส่งตัวแล้ว"; }

    return <span className={`chip ${cls}`}>{label}</span>;
}