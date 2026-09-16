import React, { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "../utils/apiFetch";
import { fmtDate } from '../utils/dateFormat';
import StatusBadge from "../components/StatusBadge";
import IssueLetterModal from "./IssueLetterModal";
import IssuePlacementLetterModal from "./IssuePlacementLetterModal";
import { PendingSignBadge } from "./LetterModalShared";
import AutoTextarea from "./AutoTextarea";
import DateInput from './DateInput';
import LoadMoreFooter from "./LoadMoreFooter";
import { useLoadMore } from "../utils/useLoadMore";

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
    advisorName?: string | null;
    generalAdvisor?: { id: number; prefix?: string; firstName: string; lastName: string } | null;
    documents?: StudentDocument[];
    // มาจาก coop.status ตรงๆ (ทุกค่าใน enum CoopStatus เช่น NOT_SUBMITTED, INTERNSHIP_STARTED, T002_SUBMITTED) — WAITING = ยังไม่มีข้อมูลสหกิจ
    docStatus?: string;
    teacherComment?: string;
    submittedAt?: string;
    coopPeriodId?: number;
    coop?: {
        coopPeriodId?: number;
        company?: { name: string };
        // ป้าย "รอลงนาม" — ตั้งตอนเจ้าหน้าที่ดาวน์โหลดร่างหนังสือ ล้างตอนอัปโหลดฉบับลงนาม
        reqLetterPendingAt?: string | null;
        reqLetterDraftNumber?: string | null;
        placeLetterPendingAt?: string | null;
        placeLetterDraftNumber?: string | null;
    }
}

// ค่าในตัวกรองบริษัทสำหรับนักศึกษาที่ยังไม่ได้เลือกบริษัท (ไม่ชนกับชื่อบริษัทจริง)
const NO_COMPANY = "__NO_COMPANY__";

// ตัวกรองป้ายรอลงนาม (ไม่ใช่สถานะใน enum — ดูจาก coop.*PendingAt)
const PENDING_SIGN_FILTERS: Record<string, (s: StudentProfile) => boolean> = {
    PENDING_SIGN_REQ: s => !!s.coop?.reqLetterPendingAt,
    PENDING_SIGN_PLACE: s => !!s.coop?.placeLetterPendingAt,
};

// เทียบเฉพาะ "ที่ปรึกษาทั่วไป" (advisorName ที่มาจากไฟล์นำเข้า Excel หรือซิงก์จากทะเบียน มข. เทียบกับ generalAdvisorId
// ที่ผูกไว้จริงในระบบ) — ไม่เกี่ยวกับ "อาจารย์ที่ปรึกษาโครงงานสหกิจ" (coopAdvisorId) ซึ่งเป็นคนละคนกันได้
function advisorMismatchWarning(student: StudentProfile): string | null {
    const linked = student.generalAdvisor;
    if (!linked || !student.advisorName) return null;
    const stored = student.advisorName.toLowerCase();
    if (!stored.includes(linked.firstName.toLowerCase()) && !stored.includes(linked.lastName.toLowerCase())) {
        const linkedFull = [linked.prefix, linked.firstName, linked.lastName].filter(Boolean).join(' ');
        return `⚠️ ชื่อที่ปรึกษาทั่วไปไม่ตรง — นักศึกษากรอก "${student.advisorName}" / ระบบเชื่อมกับ "${linkedFull}"`;
    }
    return null;
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

// สถานะตั้งแต่เริ่มฝึกงานเป็นต้นไป (ออกหนังสือส่งตัวแล้ว) — นักศึกษาผ่านทุกขั้นตอนเอกสาร T000 มาแล้ว
// เดิมปุ่มพิมพ์ซ้ำ/ตรวจสอบย้อนหลังไม่ครอบคลุมสถานะกลุ่มนี้ ทำให้เจ้าหน้าที่กลับมาดู/พิมพ์เอกสารเก่าไม่ได้เลย
// หลังนักศึกษาเข้าสู่ช่วงฝึกงาน (ส่ง T002/T003 เป็นต้นไป)
const AFTER_PLACEMENT_STATUSES = [
    'INTERNSHIP_STARTED',
    'T002_SUBMITTED', 'T002_EDITS_REQUIRED',
    'T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED',
];

const CAN_ISSUE_REQUEST_LETTER_STATUSES = [
    'DOCS_APPROVED',
    'REQ_LETTER_ISSUED',
    'WAITING_FOR_STAFF_CHECK_LETTER',
    'WAITING_FOR_PLACEMENT_LETTER',
    'ACCEPTANCE_CHECKED',
    'PLACEMENT_LETTER_ISSUED',
    ...AFTER_PLACEMENT_STATUSES,
];

// สถานะที่อยู่ในช่วง "ตรวจใบตอบรับ" (หลังออกหนังสือขอความอนุเคราะห์แล้ว) — ใช้ซ่อนปุ่ม "ตรวจสอบ T000" (คนละปุ่มกับด้านล่าง) ไม่รวมช่วงฝึกงาน เพราะปุ่มนั้นยังต้องกลับมาดูย้อนหลังได้แม้ผ่านช่วงนี้ไปแล้ว
const POST_LETTER_STATUSES = [
    'WAITING_FOR_PLACEMENT_LETTER',
    'WAITING_FOR_STAFF_CHECK_LETTER',
    'ACCEPTANCE_CHECKED',
    'PLACEMENT_LETTER_ISSUED',
];

// ใช้แสดงปุ่ม "ตรวจสอบใบตอบรับ" (ดูย้อนหลังได้แม้เข้าสู่ช่วงฝึกงานแล้ว)
const CAN_CHECK_ACCEPTANCE_STATUSES = [...POST_LETTER_STATUSES, ...AFTER_PLACEMENT_STATUSES];

// ช่วงที่ยังกดผ่าน/แก้ไข/อนุมัติทั้งหมดในหน้าต่างตรวจเอกสารได้ — นอกช่วงนี้เปิดดูย้อนหลังได้อย่างเดียว
// ขั้นที่ 1 ตรงกับ APPROVABLE ของ approveAllDocs ฝั่ง backend (+ WAITING = ยังไม่มีข้อมูลสหกิจ)
// เดิมปุ่มกดได้ทุกสถานะ: นักศึกษาที่ออกหนังสือแล้ว/ฝึกงานแล้วกด "อนุมัติทั้งหมด" ได้ 400 (ขึ้นว่าไม่สำเร็จเป็นบางคน)
// และกดผ่าน/แก้ไขรายไฟล์จะดึงสถานะนักศึกษาย้อนกลับไปขั้นตรวจเอกสาร
const PHASE1_EDITABLE_STATUSES = [
    'WAITING', 'APPLYING', 'QUALIFICATION_FAILED', 'APPLICATION_EDITS_REQUIRED', 'QUALIFIED',
    'WAITING_FOR_STAFF_CHECK', 'EDITS_REQUIRED', 'DOCS_APPROVED',
];
const PHASE2_EDITABLE_STATUSES = ['WAITING_FOR_PLACEMENT_LETTER', 'WAITING_FOR_STAFF_CHECK_LETTER', 'ACCEPTANCE_CHECKED'];

// ยังรอใบตอบรับ (นักศึกษายังไม่อัปโหลด) — บริษัทส่งมาที่เจ้าหน้าที่โดยตรงได้ ตรงกับ backend markAcceptanceReceived
const ACCEPTANCE_RECEIVABLE_STATUSES = ['REQ_LETTER_ISSUED', 'WAITING_FOR_PLACEMENT_LETTER'];

// เจ้าหน้าที่เปลี่ยน/อัปโหลดไฟล์ใบตอบรับแทนนักศึกษาได้ถึงก่อนออกหนังสือส่งตัว — ตรงกับ backend replaceAcceptanceFile
const ACCEPTANCE_REPLACEABLE_STATUSES = ['REQ_LETTER_ISSUED', 'WAITING_FOR_PLACEMENT_LETTER', 'WAITING_FOR_STAFF_CHECK_LETTER', 'ACCEPTANCE_CHECKED'];

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
    // กรองตามบริษัท: "all" = ทุกบริษัท · NO_COMPANY = ยังไม่ได้เลือกบริษัท · อื่นๆ = ชื่อบริษัท
    const [companyFilter, setCompanyFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [placementModalData, setPlacementModalData] = useState<StudentProfile | null>(null);
    // บริษัทส่งใบตอบรับมาที่เจ้าหน้าที่โดยตรง
    const [acceptanceReceivedFor, setAcceptanceReceivedFor] = useState<StudentProfile | null>(null);
    // เจ้าหน้าที่เปลี่ยนไฟล์ใบตอบรับแทนนักศึกษา (บริษัทส่งฉบับแก้มาทีหลัง) — ทำในหน้าต่างตรวจสอบใบตอบรับ
    const [replacingAcceptance, setReplacingAcceptance] = useState(false);
    const acceptanceFileRef = useRef<HTMLInputElement | null>(null);

    const [showModal, setShowModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewType, setPreviewType] = useState<"pdf" | "image" | "none">("none");
    const [adminComment, setAdminComment] = useState("");

    // 🟢 State สำหรับการเรียงลำดับ (Sorting)
    const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
            const resConf = await apiFetch("/api/admin/config/t000");
            if (resConf.ok) setConfig(await resConf.json());

            // 2. ดึงหัวข้อเอกสาร
            const resReq = await apiFetch("/api/admin/doc-requirements");
            if (resReq.ok) {
                const reqData = await resReq.json();
                if (reqData.ok) setReqDocs(reqData.requirements);
            }

            // 3. ดึงรายชื่อนักศึกษา
            const resStd = await apiFetch("/api/admin/t000/students");
            if (resStd.ok) setStudents(await resStd.json());

            // 4. ดึงข้อมูลปีการศึกษา
            const resPeriods = await apiFetch("/api/admin/coop-periods/all");
            if (resPeriods.ok) {
                const periodsData = await resPeriods.json();
                if (periodsData.ok && periodsData.periods) setCoopPeriods(periodsData.periods);
            }

        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    // ปิดหน้าออกหนังสือ → รีเฟรชเฉพาะรายชื่อ (ดาวน์โหลดร่างทำให้ป้าย "รอลงนาม" เปลี่ยน) ไม่ทับค่าตั้งค่าที่อาจกำลังแก้อยู่
    const refreshStudents = async () => {
        const res = await apiFetch("/api/admin/t000/students").catch(() => null);
        if (res?.ok) setStudents(await res.json());
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
            const res = await apiFetch("/api/admin/config/t000", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });
            if (res.ok) alert("✅ บันทึกการตั้งค่าวันเวลาเรียบร้อยแล้ว");
            else alert("❌ บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่");
        } catch (err) { alert("บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ"); }
    };

    const updateStudentState = (studentId: number, newData: Partial<StudentProfile>) => {
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...newData } : s));
        if (selectedStudent?.id === studentId) {
            setSelectedStudent(prev => prev ? { ...prev, ...newData } : null);
        }
    };

    const canEditInModal = (s: StudentProfile | null, phase: 1 | 2) =>
        !!s && (phase === 1 ? PHASE1_EDITABLE_STATUSES : PHASE2_EDITABLE_STATUSES).includes(s.docStatus || 'WAITING');

    // เปลี่ยน/อัปโหลดไฟล์ใบตอบรับแทนนักศึกษา — สถานะถอยกลับไป "รอตรวจใบตอบรับ" ให้ตรวจไฟล์ใหม่อีกครั้ง
    const handleReplaceAcceptance = async (file: File) => {
        if (!selectedStudent) return;
        if (!confirm(`เปลี่ยนไฟล์ใบตอบรับของ ${selectedStudent.firstName} ${selectedStudent.lastName} เป็น "${file.name}" ?\nสถานะจะกลับไป "รอตรวจใบตอบรับ" ให้ตรวจอีกครั้ง`)) return;
        setReplacingAcceptance(true);
        try {
            const fd = new FormData();
            fd.append('studentId', String(selectedStudent.id));
            fd.append('file', file);
            const res = await apiFetch('/api/admin/t000/acceptance-replace', { method: 'POST', body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                alert(`❌ เปลี่ยนไฟล์ไม่สำเร็จ${data.message ? `: ${data.message}` : ''}`);
                return;
            }
            setShowModal(false);
            await fetchAllData();
            alert('✅ เปลี่ยนไฟล์ใบตอบรับแล้ว — สถานะกลับไป "รอตรวจใบตอบรับ" กด "ตรวจสอบใบตอบรับ" เพื่อตรวจไฟล์ใหม่ได้เลย');
        } catch {
            alert('❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
        } finally {
            setReplacingAcceptance(false);
        }
    };

    const handleDocStatus = async (docId: number, status: "APPROVED" | "REJECTED" | "EDITS_REQUIRED") => {
        if (!selectedStudent || !canEditInModal(selectedStudent, checkPhase)) return;

        const previousDocs = selectedStudent.documents;
        const updatedDocs = selectedStudent.documents?.map(d =>
            d.id === docId ? { ...d, status: status } : d
        ) || [];
        updateStudentState(selectedStudent.id, { documents: updatedDocs });

        try {
            const res = await apiFetch(`/api/admin/doc/${docId}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            });
            if (!res.ok) {
                updateStudentState(selectedStudent.id, { documents: previousDocs });
                return;
            }

            if (checkPhase === 1) {
                const reqKeys = phase1Docs.filter(d => d.isRequired).map(r => r.key);
                if (reqKeys.length > 0) {
                    const isAllPassed = reqKeys.every(key => {
                        const found = updatedDocs.find(d => isMatch(d.type || '', key));
                        return found && found.status === 'APPROVED';
                    });
                    // DOCS_APPROVED (รอออกหนังสือ) เหมือน "อนุมัติทั้งหมด" — เดิมข้ามไป REQ_LETTER_ISSUED ทั้งที่ยังไม่ได้ออกหนังสือ
                    // นักศึกษาได้แจ้งเตือนว่าออกหนังสือแล้ว ปุ่มออกหนังสือกลายเป็น "พิมพ์ซ้ำ" และกดอนุมัติทั้งหมดต่อไม่ได้
                    if (isAllPassed) handleSubmitReview("DOCS_APPROVED", "เอกสารครบถ้วน (รอออกหนังสือ)");
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
                // ใบตอบรับไม่ผ่าน → กลับไป "รอใบตอบรับ" ให้นักศึกษาอัปโหลดใหม่ได้
                // (เดิมตั้งเป็น EDITS_REQUIRED ของขั้นเอกสาร T000 — ระบบไม่รับใบตอบรับในสถานะนั้น นักศึกษาติดค้าง)
                handleSubmitReview(checkPhase === 2 ? "WAITING_FOR_PLACEMENT_LETTER" : "EDITS_REQUIRED", "", true);
            }
        } catch (err) {
            updateStudentState(selectedStudent.id, { documents: previousDocs });
            console.error("Update doc error", err);
        }
    };

    const handleApproveAll = async () => {
        if (!selectedStudent || !canEditInModal(selectedStudent, 1)) return;
        if (!confirm("ยืนยัน 'อนุมัติทั้งหมด' ?")) return;

        const studentId = selectedStudent.id;
        const previousDocuments = selectedStudent.documents;
        const previousDocStatus = selectedStudent.docStatus;
        const previousComment = adminComment;

        const allApprovedDocs = selectedStudent.documents?.map(d => ({ ...d, status: "APPROVED" as const })) || [];
        updateStudentState(studentId, {
            documents: allApprovedDocs,
            docStatus: "DOCS_APPROVED"
        });
        setAdminComment("เอกสารครบถ้วน (รอออกหนังสือ)");

        try {
            const res = await apiFetch("/api/admin/t000/approve-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "");
            }
            fetchAllData();
        } catch (err: any) {
            console.error("Error", err);
            updateStudentState(studentId, {
                documents: previousDocuments,
                docStatus: previousDocStatus
            });
            setAdminComment(previousComment);
            // บอกเหตุผลจาก server (เช่น สถานะไม่อยู่ในช่วงที่อนุมัติได้) — เดิมขึ้นแค่ "ลองใหม่" กดซ้ำก็ไม่ผ่าน
            alert(`❌ อนุมัติทั้งหมดไม่สำเร็จ${err?.message ? `: ${err.message}` : " กรุณาลองใหม่อีกครั้ง"}`);
        }
    };

    const handleSubmitReview = async (status: string, autoComment = "", requireReason = false) => {
        if (!selectedStudent) return;

        if (!autoComment && (requireReason || status === "REJECTED" || status === "EDITS_REQUIRED") && !adminComment.trim()) {
            return alert("กรุณาระบุเหตุผลในช่องความเห็น");
        }

        const finalComment = autoComment || adminComment;
        updateStudentState(selectedStudent.id, { docStatus: status as any, teacherComment: finalComment });
        if (autoComment) setAdminComment(autoComment);

        try {
            const res = await apiFetch("/api/admin/t000/review", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: selectedStudent.id,
                    status: status,
                    comment: finalComment
                })
            });
            if (!res.ok) {
                // เดิมไม่เช็คผล — ถ้า server ปฏิเสธ หน้าจอยังโชว์สถานะใหม่ทั้งที่ข้อมูลจริงไม่เปลี่ยน
                const data = await res.json().catch(() => ({}));
                alert(`❌ บันทึกสถานะไม่สำเร็จ${data.message ? `: ${data.message}` : ""}`);
                fetchAllData();
                return;
            }
            if (!autoComment) {
                alert("บันทึกผลเรียบร้อย");
                setShowModal(false);
            }
        } catch (err) { console.error("Update Status Error", err); }
    };

    const handleSelectFile = (doc: StudentDocument) => {
        const url = `/uploads/${encodeURIComponent(doc.path)}`;
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
            const companyName = s.coop?.company?.name?.trim() || "";
            const txt = `${s.studentId} ${s.firstName} ${s.lastName} ${companyName}`.toLowerCase();
            const matchCompany = companyFilter === "all"
                || (companyFilter === NO_COMPANY ? !companyName : companyName === companyFilter);
            const st = s.docStatus || (s.documents && s.documents.length > 0 ? "WAITING_FOR_STAFF_CHECK" : "WAITING");
            const hasDoc = s.documents && s.documents.length > 0;

            // 🟢 แก้ให้ดัก coopPeriodId ได้ชัวร์ๆ
            const pId = String(s.coopPeriodId || s.coop?.coopPeriodId || "");
            const matchPeriod = selectedPeriod === "all" || pId === selectedPeriod;

            // ถ้าไม่มีไฟล์เลย จะไม่โชว์ ยกเว้นว่ามีสถานะ QUALIFIED (ผ่านคุณสมบัติแล้วรอเอกสาร)
            const shouldShow = hasDoc || st === "QUALIFIED";

            const matchStatus = statusFilter.length === 0 || statusFilter.some(f => PENDING_SIGN_FILTERS[f] ? PENDING_SIGN_FILTERS[f](s) : f === st);

            return txt.includes(q.trim().toLowerCase()) && matchStatus && matchCompany && shouldShow && matchPeriod;
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
    }, [students, q, statusFilter, companyFilter, selectedPeriod, sortKey, sortDirection]);

    // รายชื่อบริษัทสำหรับตัวกรอง (เฉพาะที่มีนักศึกษาในหน้านี้) + จำนวนนักศึกษา
    const companyOptions = useMemo(() => {
        const counts = new Map<string, number>();
        students.forEach(s => {
            const name = s.coop?.company?.name?.trim();
            if (name) counts.set(name, (counts.get(name) || 0) + 1);
        });
        return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th'));
    }, [students]);

    // แสดงทีละ 30 รายการ เลื่อนถึงท้ายตารางแล้วแสดงเพิ่ม แทนโหลดทั้งหมดในตารางเดียว
    const { shown: shownList, hasMore, sentinelRef, showMore, total } = useLoadMore(list, `${q}|${statusFilter.join(",")}|${companyFilter}|${selectedPeriod}`);

    const isSystemOpen = useMemo(() => {
        const now = new Date().getTime();
        const start = config.startDate ? new Date(config.startDate + "T00:00:00").getTime() : 0;
        const end = config.endDate ? new Date(config.endDate + "T23:59:59").getTime() : 0;
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
                            {canEditInModal(selectedStudent, checkPhase) && <div style={{ display: 'flex', gap: 5 }}>
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
                            </div>}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="page" style={{ padding: 28, marginLeft: 35 }}>

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
                        <div><label style={lbl}>วันเปิดรับ</label><DateInput className="input" value={config.startDate} onChange={e => setConfig({ ...config, startDate: e.target.value })} /></div>
                        <div><label style={lbl}>วันปิดรับ</label><DateInput className="input" value={config.endDate} onChange={e => setConfig({ ...config, endDate: e.target.value })} /></div>
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
                    <input className="input" placeholder="ค้นหา รหัสนักศึกษา / ชื่อ / บริษัท..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 280 }} />

                    {/* Dropdown เลือกบริษัท */}
                    <select className="input" style={{ width: 'auto', maxWidth: 320, background: '#f8fafc' }} value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
                        <option value="all">🏢 ทุกบริษัท</option>
                        <option value={NO_COMPANY}>— ยังไม่ระบุบริษัท —</option>
                        {companyOptions.map(([name, count]) => (
                            <option key={name} value={name}>{name} ({count})</option>
                        ))}
                    </select>

                    {/* Dropdown เลือกปีการศึกษา */}
                    <select className="input" style={{ width: 'auto', background: '#f8fafc' }} value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
                        <option value="all">📚 ทุกปีการศึกษา</option>
                        {coopPeriods.map(p => (
                            <option key={p.id} value={p.id}>เทอม {p.semester} / {p.academicYear}</option>
                        ))}
                    </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        ขั้นตอนที่ 1 — ตรวจเอกสาร T000
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        {["QUALIFIED", "WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED", "DOCS_APPROVED", "PENDING_SIGN_REQ", "REQ_LETTER_ISSUED"].map(st => (
                            <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                                <input type="checkbox" checked={statusFilter.includes(st)} onChange={e => setStatusFilter(p => e.target.checked ? [...p, st] : p.filter(x => x !== st))} />
                                {statusChip(st)}
                            </label>
                        ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        ขั้นตอนที่ 2 — ตรวจใบตอบรับ / ออกหนังสือส่งตัว
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {["WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PENDING_SIGN_PLACE", "PLACEMENT_LETTER_ISSUED"].map(st => (
                            <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                                <input type="checkbox" checked={statusFilter.includes(st)} onChange={e => setStatusFilter(p => e.target.checked ? [...p, st] : p.filter(x => x !== st))} />
                                {statusChip(st)}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table className="responsive-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
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
                            {shownList.map(s => (
                                <tr key={s.id} style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
                                    <td style={td} data-label="รหัสนักศึกษา">{s.studentId}</td>
                                    <td style={td} data-label="ชื่อ-สกุล">
                                        <div>{s.firstName} {s.lastName}</div>
                                        {s.coop?.company?.name && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>🏢 {s.coop.company.name}</div>}
                                        {(() => { const w = advisorMismatchWarning(s); return w && <div style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '3px 8px', marginTop: 4 }}>{w}</div>; })()}
                                    </td>
                                    <td style={td} data-label="ไฟล์">{s.documents?.length || 0}</td>
                                    <td style={td} data-label="วันที่ส่ง">{s.submittedAt ? fmtDate(s.submittedAt) : "-"}</td>
                                    <td style={td} data-label="สถานะ">
                                        <StatusBadge status={s.docStatus} />
                                        {s.coop?.reqLetterPendingAt && <PendingSignBadge label="รอลงนามหนังสือขอความอนุเคราะห์" at={s.coop.reqLetterPendingAt} draftNumber={s.coop.reqLetterDraftNumber} />}
                                        {s.coop?.placeLetterPendingAt && <PendingSignBadge label="รอลงนามหนังสือส่งตัว" at={s.coop.placeLetterPendingAt} draftNumber={s.coop.placeLetterDraftNumber} />}
                                    </td>
                                    <td style={td}>
                                        {(s.documents?.length || 0) > 0 && !POST_LETTER_STATUSES.includes(s.docStatus || '') && (
                                            <button className="btn" style={{ background: IOS_BLUE, color: 'white', fontSize: 12 }} onClick={() => openCheckModal(s, 1)}>
                                                🔍 ตรวจสอบ T000
                                            </button>
                                        )}
                                    </td>
                                    <td style={td}>
                                        {CAN_ISSUE_REQUEST_LETTER_STATUSES.includes(s.docStatus || '') && (
                                            <button className="btn" style={{ background: s.coop?.reqLetterPendingAt ? '#d97706' : s.docStatus === 'DOCS_APPROVED' ? '#16a34a' : '#64748b', color: 'white', fontSize: 12 }} onClick={() => setIssueModalData(s)}>
                                                {s.coop?.reqLetterPendingAt ? '✍️ อัปโหลดฉบับลงนาม' : s.docStatus === 'DOCS_APPROVED' ? '📄 ออกหนังสือขอความอนุเคราะห์' : '🖨️ พิมพ์ซ้ำ'}
                                            </button>
                                        )}
                                    </td>
                                    <td style={td}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                                            {CAN_CHECK_ACCEPTANCE_STATUSES.includes(s.docStatus || '') && (
                                                <button className="btn" style={{ background: '#3b82f6', color: 'white', fontSize: 12 }} onClick={() => openCheckModal(s, 2)}>
                                                    🔍 ตรวจสอบใบตอบรับ
                                                </button>
                                            )}
                                            {ACCEPTANCE_RECEIVABLE_STATUSES.includes(s.docStatus || '') && (
                                                <button className="btn" style={{ background: '#fff', color: '#0f766e', border: '1px solid #14b8a6', fontSize: 12 }} onClick={() => setAcceptanceReceivedFor(s)}>
                                                    📥 ได้รับจากบริษัทแล้ว
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td style={td}>
                                        {(s.docStatus === 'ACCEPTANCE_CHECKED' || s.docStatus === 'PLACEMENT_LETTER_ISSUED' || AFTER_PLACEMENT_STATUSES.includes(s.docStatus || '')) && (
                                            <button className="btn" style={{ background: s.coop?.placeLetterPendingAt ? '#d97706' : s.docStatus === 'ACCEPTANCE_CHECKED' ? '#0ea5e9' : '#64748b', color: 'white', fontSize: 12 }} onClick={() => setPlacementModalData(s)}>
                                                {s.coop?.placeLetterPendingAt ? '✍️ อัปโหลดฉบับลงนาม' : s.docStatus === 'ACCEPTANCE_CHECKED' ? '📄 ออกหนังสือส่งตัว' : '🖨️ พิมพ์ซ้ำ'}
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
                <LoadMoreFooter shownCount={shownList.length} total={total} hasMore={hasMore} onShowMore={showMore} sentinelRef={sentinelRef} itemLabel="รายการ" />
            </section>

            {/* 3. MODALS */}
            {issueModalData && (
                <IssueLetterModal student={issueModalData} onClose={() => { setIssueModalData(null); refreshStudents(); }} onSuccess={() => { setIssueModalData(null); fetchAllData(); }} />
            )}

            {placementModalData && (
                <IssuePlacementLetterModal student={placementModalData} onClose={() => { setPlacementModalData(null); refreshStudents(); }} onSuccess={() => { setPlacementModalData(null); fetchAllData(); }} />
            )}

            {acceptanceReceivedFor && (
                <AcceptanceReceivedModal
                    student={acceptanceReceivedFor}
                    onClose={() => setAcceptanceReceivedFor(null)}
                    onSuccess={() => { setAcceptanceReceivedFor(null); fetchAllData(); }}
                />
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

                        <div className="split-pane" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* LEFT: PDF PREVIEW */}
                            <div className="preview-pane" style={{ flex: '0 0 65%', background: '#334155', position: 'relative', overflow: 'hidden' }}>
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
                            <div className="control-pane" style={{ flex: '1', display: 'flex', flexDirection: 'column', background: '#fff', borderLeft: '1px solid #e2e8f0', minWidth: 320, overflow: 'hidden' }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                    <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>รายการเอกสาร</div>
                                    {checkPhase === 2 && ACCEPTANCE_REPLACEABLE_STATUSES.includes(selectedStudent.docStatus || '') && (() => {
                                        // บริษัทส่งใบตอบรับฉบับแก้ไขมาทีหลัง — เจ้าหน้าที่เปลี่ยนไฟล์ให้ได้ถึงก่อนออกหนังสือส่งตัว
                                        const hasFile = (selectedStudent.documents || []).some(d => isMatch(d.type || '', 'CP-ACCEPTANCE'));
                                        return (
                                            <>
                                                <input ref={acceptanceFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                                                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleReplaceAcceptance(f); }} />
                                                <button onClick={() => acceptanceFileRef.current?.click()} disabled={replacingAcceptance}
                                                    style={{ fontSize: 12, background: '#0f766e', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: replacingAcceptance ? 'wait' : 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(15, 118, 110, 0.2)' }}>
                                                    {replacingAcceptance ? 'กำลังอัปโหลด...' : hasFile ? '🔄 เปลี่ยนไฟล์ใบตอบรับ' : '📤 อัปโหลดใบตอบรับแทน'}
                                                </button>
                                            </>
                                        );
                                    })()}
                                    {checkPhase === 1 && canEditInModal(selectedStudent, 1) && (
                                        <button onClick={handleApproveAll} style={{ fontSize: 12, background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}>
                                            ✅ อนุมัติทั้งหมด
                                        </button>
                                    )}
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc' }}>
                                    {!canEditInModal(selectedStudent, checkPhase) && (
                                        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: 13, lineHeight: 1.6 }}>
                                            👁️ เปิดดูย้อนหลังได้อย่างเดียว — สถานะปัจจุบัน <StatusBadge status={selectedStudent.docStatus} />
                                            <div style={{ fontSize: 12, color: '#475569' }}>
                                                {selectedStudent.docStatus === 'NOT_SUBMITTED'
                                                    ? 'นักศึกษายังไม่ได้ยื่นคำร้องสหกิจ จึงยังตรวจเอกสารไม่ได้'
                                                    : 'ผ่านขั้นตอนนี้ไปแล้ว การกดผ่าน/แก้ไขจะทำให้สถานะนักศึกษาย้อนกลับ'}
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {activeDocs.map((req) => {
                                            const docs = selectedStudent.documents?.filter(d => isMatch(d.type || '', req.key)) || [];
                                            return renderDocGroup(req.label, req.isRequired, docs);
                                        })}
                                    </div>
                                </div>

                                <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
                                    <AutoTextarea className="input" rows={2} style={{ width: '100%', marginBottom: 8, fontSize: 13 }}
                                        placeholder="ระบุเหตุผล (กรณีแก้ไข/ไม่ผ่าน)"
                                        value={adminComment} onChange={e => setAdminComment(e.target.value)}
                                        disabled={!canEditInModal(selectedStudent, checkPhase)}
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

                .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; justify-content: center; alignItems: center; z-index: 9999; backdrop-filter: blur(4px); }
                .modal-card { background: #fff; border-radius: 12px; width: 95vw; height: 90vh; max-width: 1400px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
                @media (max-width: 768px) {
                    .split-pane { flex-direction: column !important; overflow-y: auto !important; }
                    .preview-pane { flex: 0 0 280px !important; }
                    .control-pane { min-width: 0 !important; }
                }

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
                .chip.sign { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; }

                .action-btn { flex: 1; }
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

// บริษัทส่งใบตอบรับมาที่เจ้าหน้าที่โดยตรง — แนบไฟล์ (ถ้ามี) แล้วเปลี่ยนเป็น "ตรวจใบตอบรับแล้ว" ออกหนังสือส่งตัวต่อได้เลย
function AcceptanceReceivedModal({ student, onClose, onSuccess }: { student: StudentProfile; onClose: () => void; onSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!confirm(`ยืนยันว่าได้รับใบตอบรับของ ${student.firstName} ${student.lastName} จากบริษัทแล้ว?`)) return;
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("studentId", String(student.id));
            if (note.trim()) fd.append("note", note.trim());
            if (file) fd.append("file", file);
            const res = await apiFetch("/api/admin/t000/acceptance-received", { method: "POST", body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                alert(`❌ บันทึกไม่สำเร็จ${data.message ? `: ${data.message}` : ""}`);
                return;
            }
            alert("✅ บันทึกแล้ว — ออกหนังสือส่งตัวต่อได้เลย");
            onSuccess();
        } catch {
            alert("❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 10000, alignItems: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(480px, 92vw)', boxShadow: '0 20px 40px rgba(0,0,0,.3)' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 18, color: '#1e293b' }}>📥 ได้รับใบตอบรับจากบริษัทโดยตรง</h3>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{student.studentId} - {student.firstName} {student.lastName}</div>

                <label style={lbl}>ไฟล์ใบตอบรับ (ถ้ามี)</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} style={{ marginBottom: 12, fontSize: 13 }} />

                <label style={lbl}>หมายเหตุ (ถ้ามี)</label>
                <input className="input" style={{ width: '100%', marginBottom: 12 }} placeholder="เช่น บริษัทส่งทางอีเมล / ไปรษณีย์" value={note} onChange={e => setNote(e.target.value)} maxLength={500} />

                <div style={{ fontSize: 12, color: '#475569', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '8px 10px', marginBottom: 16, lineHeight: 1.6 }}>
                    สถานะนักศึกษาจะเปลี่ยนเป็น "ตรวจใบตอบรับแล้ว" และแจ้งนักศึกษาว่าไม่ต้องอัปโหลดใบตอบรับ
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button className="btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={onClose} disabled={saving}>ยกเลิก</button>
                    <button className="btn" style={{ background: '#0f766e', color: '#fff' }} onClick={submit} disabled={saving}>
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </div>
    );
}

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
    else if (s === "PENDING_SIGN_REQ") { cls = "sign"; label = "✍️ รอลงนามหนังสือขอความอนุเคราะห์"; }
    else if (s === "PENDING_SIGN_PLACE") { cls = "sign"; label = "✍️ รอลงนามหนังสือส่งตัว"; }

    return <span className={`chip ${cls}`}>{label}</span>;
}