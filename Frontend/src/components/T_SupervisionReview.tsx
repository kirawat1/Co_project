import React, { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import { apiFetch } from "../utils/apiFetch";
import { fmtDate, fmtDateTime } from '../utils/dateFormat';
import StatusBadge from "./StatusBadge";
import SupervisionCalendar from "./SupervisionCalendar";
import type { CalendarEvent } from "./SupervisionCalendar";
import AutoTextarea from "./AutoTextarea";
import IssueSupervisionLetterModal from "./IssueSupervisionLetterModal";
import { useToast } from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import Spinner from "./Spinner";
import T_GroupSupervision from "./T_GroupSupervision";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SupervisionAppt {
    id: number;
    studentId: number;
    proposedDates: string;
    supervisionType: "ONLINE" | "ONSITE";
    onlineLink: string | null;
    confirmedDate: string | null;
    rejectReason: string | null;
    status: string;
    officialLetterPath: string | null;
    isPrimaryAdvisor?: boolean;
    coopPeriodId?: number;
    coTeacherName?: string | null;
    student: {
        studentId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        coopPeriodId?: number;
        coop: {
            coopPeriodId?: number;
            company: { name: string; address: string; phone: string | null; contactPerson: string | null; } | null;
        } | null;
    };
    teacher?: { prefix?: string; firstName: string; lastName: string; };
}

interface CoopPeriod {
    id: number;
    semester: string | number;
    academicYear: string;
    startDate: string;
    endDate: string;
    supervisionStartDate: string | null;
    supervisionEndDate: string | null;
    isSupervisionOpen: boolean;
    isActive: boolean;
}

interface Teacher {
    id: number;
    prefix?: string;
    firstName: string;
    lastName: string;
}

type SortKey = 'studentId' | 'company' | 'type' | 'status' | 'confirmedDate';
type AllSortKey = 'student' | 'company' | 'teacher' | 'datetime' | 'status';
type SortDirection = 'asc' | 'desc';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeHref(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) ? url : undefined; }
    catch { return undefined; }
}


const parseProposed = (dateStr: string) => {
    const parts = dateStr.includes("|") ? dateStr.split("|") : [dateStr, "", ""];
    const [dPart = "", tPart = "", typePart = ""] = parts;
    const dmy = fmtDate(dPart);
    const dayKey = dPart.slice(0, 10);
    const type = typePart === "ONSITE" ? "ONSITE" : typePart === "ONLINE" ? "ONLINE" : undefined;
    return { dmy, time: tPart ? `${tPart} น.` : "", dayKey, raw: dateStr, type };
};

function parseProposedList(raw: string): { dmy: string; time: string }[] {
    try {
        const arr: string[] = JSON.parse(raw || "[]");
        return arr.map(entry => {
            const [dPart = "", tPart = ""] = entry.includes("|") ? entry.split("|") : [entry, ""];
            const dmy = fmtDate(dPart);
            return { dmy, time: tPart || "" };
        });
    } catch { return []; }
}

// ─── Tab Button ──────────────────────────────────────────────────────────────

const TabBtn = ({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) => (
    <button
        onClick={onClick}
        style={{
            padding: '12px 24px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            background: active ? '#fff' : '#f8fafc',
            color: active ? '#0074B7' : '#64748b',
            borderBottom: active ? '3px solid #0074B7' : '3px solid transparent',
            transition: 'all .15s',
            display: 'flex', alignItems: 'center', gap: 8,
        }}
    >
        {label}
        {count > 0 && (
            <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 99 }}>
                {count}
            </span>
        )}
    </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function T_SupervisionReview() {
    const toast = useToast();
    const token = localStorage.getItem("coop.token");

    // ── Profile / Tab
    const [isCoopTeacher, setIsCoopTeacher] = useState(false);
    const [activeTab, setActiveTab] = useState<'mine' | 'all' | 'group'>('mine');

    // ══════════════ "ของฉัน" state ══════════════
    const [mySupervisions, setMySupervisions] = useState<SupervisionAppt[]>([]);
    const [myLoading, setMyLoading] = useState(true);
    const [periods, setPeriods] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAppt, setSelectedAppt] = useState<SupervisionAppt | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("studentId");
    const [sortDir, setSortDir] = useState<SortDirection>("asc");

    // ══════════════ "ทั้งหมด" state ══════════════
    const [allSupervisions, setAllSupervisions] = useState<SupervisionAppt[]>([]);
    const [allLoading, setAllLoading] = useState(false);
    const [allPeriods, setAllPeriods] = useState<CoopPeriod[]>([]);
    const [teachersList, setTeachersList] = useState<Teacher[]>([]);
    const [allQ, setAllQ] = useState("");
    const [allPeriodFilter, setAllPeriodFilter] = useState<string>("all");
    const [allSortKey, setAllSortKey] = useState<AllSortKey>('student');
    const [allSortDir, setAllSortDir] = useState<SortDirection>('asc');
    // period config
    const [selPeriodId, setSelPeriodId] = useState<number | "">("");
    const [periodOpen, setPeriodOpen] = useState(false);
    const [supStart, setSupStart] = useState("");
    const [supEnd, setSupEnd] = useState("");
    const [savingConfig, setSavingConfig] = useState(false);
    // modals
    const [assignSup, setAssignSup] = useState<SupervisionAppt | null>(null);
    const [coTeachers, setCoTeachers] = useState<string[]>([]);
    const [editDateSup, setEditDateSup] = useState<SupervisionAppt | null>(null);
    const [editDateVal, setEditDateVal] = useState("");
    const [editDateTime, setEditDateTime] = useState("09:00");
    const [savingDate, setSavingDate] = useState(false);
    const [confirmEditOpen, setConfirmEditOpen] = useState(false);
    const [letterSup, setLetterSup] = useState<SupervisionAppt | null>(null);

    // ── Badges
    const myPendingCount = mySupervisions.filter(s => s.status === 'PENDING_TEACHER' && s.isPrimaryAdvisor !== false).length;
    const allPendingCount = allSupervisions.filter(s => !s.coTeacherName).length;

    // ── Fetch profile
    useEffect(() => {
        axios.get('/api/teacher/me', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setIsCoopTeacher(!!res.data?.isCoopTeacher))
            .catch(() => {});
    }, []);

    // ── Fetch "ของฉัน"
    const fetchMine = async () => {
        setMyLoading(true);
        try {
            const resPeriods = await apiFetch("/api/admin/coop-periods/all");
            if (resPeriods.ok) {
                const d = await resPeriods.json();
                if (d.ok && d.periods) setPeriods(d.periods);
            }
            const res = await axios.get("/api/teacher/supervisions", { headers: { Authorization: `Bearer ${token}` } });
            if (res.data?.supervisions) setMySupervisions(res.data.supervisions);
        } catch (err) { console.error(err); }
        finally { setMyLoading(false); }
    };

    // ── Fetch "ทั้งหมด"
    const fetchAll = async () => {
        setAllLoading(true);
        try {
            const [periodRes, supRes, teacherRes] = await Promise.all([
                axios.get("/api/admin/supervision-periods", { headers: { Authorization: `Bearer ${token}` } }),
                axios.get("/api/admin/supervisions", { headers: { Authorization: `Bearer ${token}` } }),
                axios.get("/api/teachers", { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            if (periodRes.data?.periods) {
                const ps: CoopPeriod[] = periodRes.data.periods;
                setAllPeriods(ps);
                const active = ps.find(p => p.isActive) || ps[0];
                if (active) selectAllPeriod(active.id, ps);
            }
            if (supRes.data?.supervisions) setAllSupervisions(supRes.data.supervisions);
            const td = teacherRes.data;
            setTeachersList(td?.teachers ?? td?.data ?? (Array.isArray(td) ? td : []));
        } catch (err) { console.error(err); }
        finally { setAllLoading(false); }
    };

    useEffect(() => { fetchMine(); }, []);
    useEffect(() => { if (isCoopTeacher) fetchAll(); }, [isCoopTeacher]);

    const selectAllPeriod = (id: number, ps = allPeriods) => {
        setSelPeriodId(id);
        const p = ps.find(x => x.id === id);
        if (p) {
            setPeriodOpen(p.isSupervisionOpen || false);
            setSupStart(p.supervisionStartDate ? p.supervisionStartDate.split('T')[0] : "");
            setSupEnd(p.supervisionEndDate ? p.supervisionEndDate.split('T')[0] : "");
        }
    };

    // ══════════════ "ของฉัน" handlers ══════════════

    const bookedDayMap = useMemo(() => {
        const map = new Map<string, { name: string; time: string; studentId: string }>();
        mySupervisions.forEach(sup => {
            if (sup.status === "DATE_CONFIRMED" && sup.confirmedDate) {
                const d = new Date(sup.confirmedDate);
                if (!isNaN(d.getTime())) {
                    map.set(d.toISOString().slice(0, 10), {
                        name: `${sup.student.firstName} ${sup.student.lastName}`,
                        time: fmtDateTime(sup.confirmedDate),
                        studentId: sup.student.studentId,
                    });
                }
            }
        });
        return map;
    }, [mySupervisions]);

    const handleSort = (key: SortKey) => {
        setSortDir(sortKey === key && sortDir === "asc" ? "desc" : "asc");
        setSortKey(key);
    };

    const processedMine = useMemo(() => {
        let f = mySupervisions.filter(s => {
            const match = `${s.student.studentId} ${s.student.firstName} ${s.student.lastName} ${s.student.coop?.company?.name || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
            const pId = String(s.coopPeriodId || s.student.coopPeriodId || s.student.coop?.coopPeriodId || "");
            return match && (selectedPeriod === "all" || pId === selectedPeriod);
        });
        f.sort((a, b) => {
            let valA = "", valB = "";
            switch (sortKey) {
                case "studentId": valA = a.student.studentId || ""; valB = b.student.studentId || ""; break;
                case "company": valA = a.student.coop?.company?.name || ""; valB = b.student.coop?.company?.name || ""; break;
                case "type": valA = a.supervisionType; valB = b.supervisionType; break;
                case "status": valA = a.status; valB = b.status; break;
                case "confirmedDate": valA = a.confirmedDate || ""; valB = b.confirmedDate || ""; break;
            }
            if (valA < valB) return sortDir === "asc" ? -1 : 1;
            if (valA > valB) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
        return f;
    }, [mySupervisions, selectedPeriod, searchTerm, sortKey, sortDir]);

    const openReviewModal = (appt: SupervisionAppt) => { setSelectedAppt(appt); setRejectReason(appt.rejectReason || ""); };
    const closeModal = () => { setSelectedAppt(null); setRejectReason(""); };

    const handleAction = async (action: "APPROVE" | "REJECT", confirmedDateStr?: string) => {
        if (action === "REJECT" && !rejectReason.trim()) return alert("กรุณาระบุเหตุผล เพื่อให้นักศึกษาทราบและเลือกวันใหม่");
        const confirmMsg = action === "APPROVE"
            ? `ยืนยันการเลือกวันนี้?\n\n${confirmedDateStr ? parseProposed(confirmedDateStr).dmy + " เวลา " + parseProposed(confirmedDateStr).time : ""}`
            : "ยืนยันการปฏิเสธและให้นักศึกษาเสนอวันใหม่?";
        if (!confirm(confirmMsg)) return;
        setIsSubmitting(true);
        try {
            let finalConfirmedDate: string | null = null;
            if (action === "APPROVE" && confirmedDateStr) {
                const [dPart, tPart] = confirmedDateStr.split("|");
                const startTime = (tPart || "00:00").split("-")[0];
                finalConfirmedDate = new Date(`${dPart}T${startTime}:00`).toISOString();
            }
            const supervisionType = (action === "APPROVE" && confirmedDateStr) ? parseProposed(confirmedDateStr).type ?? selectedAppt?.supervisionType : undefined;
            await axios.put(`/api/teacher/supervisions/${selectedAppt?.id}/review`, {
                action, confirmedDate: finalConfirmedDate,
                rejectReason: action === "REJECT" ? rejectReason : null, supervisionType
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert("บันทึกผลการพิจารณาเรียบร้อยแล้ว");
            closeModal(); fetchMine();
        } catch (err: any) { alert(err?.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก"); }
        finally { setIsSubmitting(false); }
    };

    const handleMyComplete = async (id: number) => {
        if (!confirm("ยืนยันว่าการนิเทศเสร็จสิ้นแล้ว?")) return;
        try {
            await axios.put(`/api/teacher/supervisions/${id}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
            alert("บันทึกผลนิเทศเสร็จสิ้นสำเร็จ"); fetchMine();
        } catch (err: any) { alert(err?.response?.data?.message || "เกิดข้อผิดพลาด"); }
    };

    const myCalendarEvents = useMemo<CalendarEvent[]>(() =>
        mySupervisions.filter(s => s.confirmedDate && ["DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"].includes(s.status))
            .map(s => ({ id: s.id, confirmedDate: s.confirmedDate!, studentId: s.student.studentId, studentName: `${s.student.firstName} ${s.student.lastName}`, type: s.supervisionType, status: s.status, companyName: s.student.coop?.company?.name, onlineLink: s.onlineLink, groupId: (s as any).groupId ?? null })),
        [mySupervisions]);

    // ══════════════ "ทั้งหมด" handlers ══════════════

    const handleSaveConfig = async () => {
        if (!selPeriodId) { toast.warning("กรุณาเลือกรอบสหกิจก่อน"); return; }
        setSavingConfig(true);
        try {
            await axios.post("/api/admin/supervision-periods", { periodId: selPeriodId, isSupervisionOpen: periodOpen, supervisionStartDate: supStart || null, supervisionEndDate: supEnd || null }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("บันทึกช่วงเวลานิเทศเรียบร้อยแล้ว"); fetchAll();
        } catch { toast.error("เกิดข้อผิดพลาดในการบันทึก"); }
        finally { setSavingConfig(false); }
    };

    const handleAllSort = (key: AllSortKey) => {
        setAllSortDir(allSortKey === key && allSortDir === 'asc' ? 'desc' : 'asc');
        setAllSortKey(key);
    };

    const processedAll = useMemo(() => {
        let f = allSupervisions.filter(s => {
            const search = `${s.student.studentId} ${s.student.firstName} ${s.student.lastName} ${s.student.coop?.company?.name || ""} ${s.teacher?.firstName || ""} ${s.teacher?.lastName || ""}`.toLowerCase();
            const pId = String((s as any).coopPeriodId || s.student.coopPeriodId || s.student.coop?.coopPeriodId || "");
            return search.includes(allQ.toLowerCase()) && (allPeriodFilter === "all" || pId === allPeriodFilter);
        });
        f.sort((a, b) => {
            let valA = "", valB = "";
            switch (allSortKey) {
                case 'student': valA = a.student.studentId; valB = b.student.studentId; break;
                case 'company': valA = a.student.coop?.company?.name || ""; valB = b.student.coop?.company?.name || ""; break;
                case 'teacher': valA = a.teacher?.firstName || ""; valB = b.teacher?.firstName || ""; break;
                case 'datetime': valA = a.confirmedDate || a.proposedDates; valB = b.confirmedDate || b.proposedDates; break;
                case 'status': valA = a.status; valB = b.status; break;
            }
            if (valA < valB) return allSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return allSortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return f;
    }, [allSupervisions, allQ, allPeriodFilter, allSortKey, allSortDir]);

    const openAssignModal = (sup: SupervisionAppt) => {
        setAssignSup(sup);
        setCoTeachers(sup.coTeacherName ? sup.coTeacherName.split(',').map(n => n.trim()) : []);
    };
    const toggleCoTeacher = (name: string) => setCoTeachers(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);
    const handleSaveCoTeachers = async () => {
        if (!assignSup) return;
        try {
            await axios.put(`/api/admin/supervisions/${assignSup.id}/co-teachers`, { coTeacherName: coTeachers.length > 0 ? coTeachers.join(', ') : null }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("บันทึกรายชื่ออาจารย์นิเทศเรียบร้อย"); setAssignSup(null); fetchAll();
        } catch { toast.error("เกิดข้อผิดพลาดในการบันทึก"); }
    };

    const openEditDateModal = (sup: SupervisionAppt) => {
        setEditDateSup(sup);
        if (sup.confirmedDate) {
            const d = new Date(sup.confirmedDate);
            setEditDateVal(d.toISOString().split('T')[0]);
            setEditDateTime(d.toTimeString().slice(0, 5));
        } else { setEditDateVal(""); setEditDateTime("09:00"); }
    };
    const handleSaveEditDate = async () => {
        if (!editDateSup || !editDateVal) return;
        setSavingDate(true); setConfirmEditOpen(false);
        try {
            const iso = new Date(`${editDateVal}T${editDateTime}:00`).toISOString();
            await axios.put(`/api/admin/supervisions/${editDateSup.id}/confirmed-date`, { confirmedDate: iso }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("แก้ไขวันนิเทศเรียบร้อยแล้ว"); setEditDateSup(null); fetchAll();
        } catch (err: any) { toast.error(err?.response?.data?.message || "เกิดข้อผิดพลาด"); }
        finally { setSavingDate(false); }
    };

    const handleAllComplete = async (sup: SupervisionAppt) => {
        if (!confirm("ยืนยันว่าการนิเทศเสร็จสิ้นแล้ว?")) return;
        try {
            await axios.put(`/api/admin/supervisions/${sup.id}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("บันทึกผลนิเทศเสร็จสิ้น"); fetchAll();
        } catch (err: any) { toast.error(err?.response?.data?.message || "เกิดข้อผิดพลาด"); }
    };

    const allCalendarEvents = useMemo<CalendarEvent[]>(() =>
        allSupervisions.filter(s => s.confirmedDate && ["DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"].includes(s.status))
            .map(s => ({ id: s.id, confirmedDate: s.confirmedDate!, studentId: s.student.studentId, studentName: `${s.student.firstName} ${s.student.lastName}`, type: s.supervisionType, status: s.status, companyName: s.student.coop?.company?.name, onlineLink: s.onlineLink ?? null, groupId: (s as any).groupId ?? null })),
        [allSupervisions]);

    const SortIcon = ({ col }: { col: SortKey }) => col === sortKey ? <span style={{ color: "#2563eb", marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span> : <span style={{ color: "#cbd5e1", marginLeft: 4 }}>↕</span>;
    const AllSortIcon = ({ col }: { col: AllSortKey }) => col === allSortKey ? <span style={{ color: "#0ea5e9", marginLeft: 4 }}>{allSortDir === 'asc' ? '↑' : '↓'}</span> : <span style={{ color: '#cbd5e1', marginLeft: 4 }}>↕</span>;

    const selPeriodData = allPeriods.find(p => p.id === selPeriodId);

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* ── Tabs (isCoopTeacher only) ── */}
            {isCoopTeacher && (
                <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
                    <TabBtn active={activeTab === 'mine'} onClick={() => setActiveTab('mine')} label="📋 ของฉัน" count={myPendingCount} />
                    <TabBtn active={activeTab === 'all'} onClick={() => setActiveTab('all')} label="🗂️ ทั้งหมด" count={allPendingCount} />
                    <TabBtn active={activeTab === 'group'} onClick={() => setActiveTab('group')} label="🏢 นิเทศตามบริษัท" count={0} />
                </div>
            )}

            {/* ══════════════════ TAB: ของฉัน ══════════════════ */}
            {activeTab === 'mine' && (
                <>
                    <section style={{ ...card, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 15 }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1e293b" }}>👨‍🏫 พิจารณาวันนิเทศสหกิจศึกษา</h2>
                            <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>ตรวจสอบและเลือกวันนิเทศ (เฉพาะอาจารย์ที่ปรึกษาหลักจะมีสิทธิ์เลือกเวลา)</div>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                            <input className="input" placeholder="🔍 ค้นหารหัส / ชื่อ / บริษัท..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: 250 }} />
                            <select className="input" style={{ width: "auto" }} value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
                                <option value="all">📚 ทุกปีการศึกษา</option>
                                {periods.map(p => <option key={p.id} value={p.id}>เทอม {p.semester} / {p.academicYear}</option>)}
                            </select>
                            <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={fetchMine} disabled={myLoading}>{myLoading ? "⏳" : "🔄"} รีเฟรช</button>
                            <div style={{ background: "#ecfdf5", color: "#047857", padding: "10px 16px", borderRadius: 8, fontWeight: 700, border: "1px solid #a7f3d0" }}>
                                ทั้งหมด: {processedMine.length} รายการ
                            </div>
                        </div>
                    </section>

                    {bookedDayMap.size > 0 && (
                        <section style={{ ...card, marginBottom: 16, background: "#fffbeb", border: "1px solid #fde68a" }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "#92400e", marginBottom: 8 }}>📅 วันที่ถูกยืนยันแล้ว (ห้ามเลือกซ้ำ)</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {Array.from(bookedDayMap.entries()).map(([day, info]) => (
                                    <div key={day} style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "6px 12px", fontSize: 13 }}>
                                        <span style={{ fontWeight: 700 }}>{fmtDate(day + 'T00:00:00')}</span>
                                        <span style={{ color: "#78350f", marginLeft: 6 }}>— {info.name} ({info.time})</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section style={{ marginBottom: 24 }}>
                        <SupervisionCalendar events={myCalendarEvents} title="📅 ปฏิทินนิเทศของคุณ (วันที่ยืนยันแล้ว)" />
                    </section>

                    {myLoading ? <div style={{ textAlign: 'center', padding: 40, color: '#0074B7' }}>กำลังโหลด...</div> : (
                        <section style={card}>
                            <div style={{ overflowX: "auto" }}>
                                <table style={tableStyle}>
                                    <thead>
                                        <tr style={thRow}>
                                            <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort("studentId")}>รหัสนักศึกษา / ชื่อ <SortIcon col="studentId" /></th>
                                            <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort("company")}>หน่วยงาน <SortIcon col="company" /></th>
                                            <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort("type")}>รูปแบบ <SortIcon col="type" /></th>
                                            <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort("confirmedDate")}>วันนิเทศ <SortIcon col="confirmedDate" /></th>
                                            <th style={th}>สิทธิ์</th>
                                            <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort("status")}>สถานะ <SortIcon col="status" /></th>
                                            <th style={{ ...th, textAlign: "right" }}>จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {processedMine.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีรายการนิเทศที่ตรงกับเงื่อนไข</td></tr>
                                        ) : processedMine.map(sup => {
                                            const isPrimary = sup.isPrimaryAdvisor !== false;
                                            return (
                                                <tr key={sup.id} style={trStyle}>
                                                    <td style={td}><div style={{ fontWeight: 700 }}>{sup.student.studentId}</div><div style={{ fontSize: 13, color: "#64748b" }}>{sup.student.firstName} {sup.student.lastName}</div></td>
                                                    <td style={td}><div style={{ fontWeight: 600 }}>{sup.student.coop?.company?.name || "-"}</div></td>
                                                    <td style={td}><span style={{ fontWeight: 700, color: sup.supervisionType === "ONLINE" ? "#2563eb" : "#ea580c" }}>{sup.supervisionType === "ONLINE" ? "🌐 ออนไลน์" : "🏢 ออนไซต์"}</span></td>
                                                    <td style={td}>
                                                        {sup.confirmedDate ? <div style={{ fontWeight: 700, color: "#16a34a" }}>✅ {fmtDateTime(sup.confirmedDate)}</div> : sup.proposedDates ? (() => {
                                                            let dates: string[] = [];
                                                            try { dates = JSON.parse(sup.proposedDates); } catch { dates = []; }
                                                            return <>{<div style={{ fontSize: 11, color: "#92400e", fontWeight: 700, marginBottom: 4 }}>⏳ วันที่เสนอ</div>}{dates.map((d, i) => { const p = parseProposed(d); return <div key={i} style={{ fontSize: 12, color: "#78350f", background: "#fef3c7", padding: "2px 6px", borderRadius: 4, marginBottom: 2 }}>{p.dmy}{p.time ? ` · ${p.time}` : ""}</div>; })}</>;
                                                        })() : <span style={{ color: "#94a3b8" }}>ยังไม่เสนอวัน</span>}
                                                    </td>
                                                    <td style={td}><span style={{ background: isPrimary ? "#eff6ff" : "#f8fafc", color: isPrimary ? "#2563eb" : "#64748b", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: "bold", border: `1px solid ${isPrimary ? "#bfdbfe" : "#e2e8f0"}` }}>{isPrimary ? "👑 หลัก" : "🤝 ร่วม"}</span></td>
                                                    <td style={td}><StatusBadge status={sup.status} /></td>
                                                    <td style={{ ...td, textAlign: "right" }}>
                                                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                                            {sup.status === "LETTER_UPLOADED" && isPrimary && <button className="btn" style={{ background: "#7c3aed", padding: "8px 16px" }} onClick={() => handleMyComplete(sup.id)}>🏁 จบนิเทศ</button>}
                                                            <button className={sup.status === "PENDING_TEACHER" && isPrimary ? "btn-success" : "btn"} style={{ padding: "8px 16px" }} onClick={() => openReviewModal(sup)}>
                                                                {sup.status === "PENDING_TEACHER" && isPrimary ? "พิจารณาวันนิเทศ" : "🔍 ดูรายละเอียด"}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* Modal พิจารณาวัน */}
                    {selectedAppt && (
                        <div className="modal-backdrop">
                            <div className="modal-card-split" style={{ maxWidth: 1000 }}>
                                <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>{selectedAppt.isPrimaryAdvisor === false ? "ดูรายละเอียด: " : "พิจารณาวันนิเทศ: "}{selectedAppt.student.firstName} {selectedAppt.student.lastName}</h3>
                                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>รหัส: {selectedAppt.student.studentId} | <StatusBadge status={selectedAppt.status} /></div>
                                    </div>
                                    <button onClick={closeModal} style={{ border: "none", background: "#fee2e2", color: "#dc2626", width: 32, height: 32, borderRadius: "50%", fontSize: 18, cursor: "pointer" }}>&times;</button>
                                </div>
                                <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                                    <div style={{ flex: 1, padding: 24, background: "#f8fafc", borderRight: "1px solid #e2e8f0", overflowY: "auto" }}>
                                        <div style={{ background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20 }}>
                                            <InfoRow label="รูปแบบ" value={<span style={{ color: selectedAppt.supervisionType === "ONLINE" ? "#2563eb" : "#ea580c" }}>{selectedAppt.supervisionType === "ONLINE" ? "🌐 ออนไลน์" : "🏢 ออนไซต์"}</span>} />
                                            {selectedAppt.supervisionType === "ONLINE" && <InfoRow label="Link" value={selectedAppt.onlineLink ? <a href={safeHref(selectedAppt.onlineLink)} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>{selectedAppt.onlineLink}</a> : "-"} />}
                                            {selectedAppt.confirmedDate && <InfoRow label="วันนิเทศ" value={<span style={{ color: "#16a34a", fontWeight: 700 }}>{fmtDateTime(selectedAppt.confirmedDate)}</span>} />}
                                        </div>
                                        <div style={{ background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20 }}>
                                            <div style={{ fontWeight: 800, marginBottom: 12 }}>🏢 สถานที่ฝึกงาน</div>
                                            <div style={{ fontSize: 14, lineHeight: 1.8, color: "#475569" }}>
                                                <b>บริษัท:</b> {selectedAppt.student.coop?.company?.name || "-"}<br />
                                                <b>ติดต่อ:</b> {selectedAppt.student.coop?.company?.contactPerson || "-"} (โทร: {selectedAppt.student.coop?.company?.phone || "-"})<br />
                                                <b>ที่อยู่:</b> {selectedAppt.student.coop?.company?.address || "-"}
                                            </div>
                                        </div>
                                        {bookedDayMap.size > 0 && (
                                            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 14 }}>
                                                <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8, fontSize: 13 }}>⚠️ วันที่ยืนยันไปแล้ว</div>
                                                {Array.from(bookedDayMap.entries()).map(([day, info]) => <div key={day} style={{ fontSize: 13, color: "#78350f", marginBottom: 4 }}>• <b>{fmtDate(day + 'T00:00:00')}</b> — {info.name}</div>)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, padding: 24, background: "#fff", overflowY: "auto", display: "flex", flexDirection: "column" }}>
                                        {selectedAppt.status === "PENDING_TEACHER" && selectedAppt.isPrimaryAdvisor !== false && (
                                            <>
                                                <h4 style={{ margin: "0 0 10px 0", color: "#0f172a" }}>✅ เลือกวันที่นักศึกษาเสนอ</h4>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                                    {(() => {
                                                        let dates: string[] = [];
                                                        try { dates = JSON.parse(selectedAppt.proposedDates || "[]"); } catch { dates = []; }
                                                        return dates.map((dateStr, idx) => {
                                                            const parsed = parseProposed(dateStr);
                                                            const bookedEntry = bookedDayMap.get(parsed.dayKey);
                                                            const isBooked = !!bookedEntry && bookedEntry.studentId !== selectedAppt.student.studentId;
                                                            return (
                                                                <div key={idx} style={{ padding: 16, background: isBooked ? "#fef2f2" : "#f0fdf4", border: `1px solid ${isBooked ? "#fca5a5" : "#bbf7d0"}`, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                    <div>
                                                                        <div style={{ fontWeight: 800, color: isBooked ? "#991b1b" : "#166534", fontSize: 15 }}>{isBooked ? "🔒 " : ""}{parsed.dmy}</div>
                                                                        <div style={{ color: isBooked ? "#b91c1c" : "#15803d", fontSize: 14, marginTop: 4 }}>{parsed.time}</div>
                                                                    </div>
                                                                    <button className={isBooked ? "btn" : "btn-success"} style={{ background: isBooked ? "#9ca3af" : undefined, padding: "10px 16px", cursor: isBooked ? "not-allowed" : "pointer" }} onClick={() => !isBooked && handleAction("APPROVE", dateStr)} disabled={isSubmitting || isBooked}>{isBooked ? "ถูกจองแล้ว" : "เลือกวันนี้"}</button>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                                <div style={{ margin: "24px 0", borderTop: "1px dashed #cbd5e1" }} />
                                                <h4 style={{ margin: "0 0 10px 0", color: "#991b1b" }}>⚠️ กรณีไม่สะดวกทุกวัน</h4>
                                                <AutoTextarea className="input" rows={3} placeholder="เช่น ขอเลื่อนเป็นสัปดาห์หน้า..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                                                <button className="btn-danger" style={{ width: "100%", marginTop: 12 }} onClick={() => handleAction("REJECT")} disabled={isSubmitting}>ปฏิเสธให้เลือกวันใหม่</button>
                                            </>
                                        )}
                                        {selectedAppt.status === "PENDING_TEACHER" && selectedAppt.isPrimaryAdvisor === false && (
                                            <div style={{ textAlign: "center", marginTop: "10%" }}>
                                                <div style={{ fontSize: 48, marginBottom: 10 }}>👀</div>
                                                <h3 style={{ margin: "0 0 10px 0" }}>รออาจารย์ที่ปรึกษาหลักยืนยัน</h3>
                                            </div>
                                        )}
                                        {selectedAppt.status !== "PENDING_TEACHER" && (
                                            <div style={{ textAlign: "center", marginTop: "15%" }}>
                                                {selectedAppt.status === "TEACHER_REJECTED"
                                                    ? <div style={{ color: "#dc2626", fontWeight: "bold" }}><div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>แจ้งให้นักศึกษาเลือกวันใหม่แล้ว<br /><span style={{ fontSize: 13, color: "#64748b", fontWeight: "normal", display: "block", marginTop: 8 }}>เหตุผล: {selectedAppt.rejectReason || "-"}</span></div>
                                                    : <div style={{ color: "#16a34a", fontWeight: "bold" }}><div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>ยืนยันวันนิเทศเรียบร้อย<br /><span style={{ fontSize: 14, color: "#475569", fontWeight: "normal", display: "block", marginTop: 10 }}>วันที่: {fmtDateTime(selectedAppt.confirmedDate)}</span></div>
                                                }
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ══════════════════ TAB: ทั้งหมด ══════════════════ */}
            {isCoopTeacher && activeTab === 'all' && (
                <>
                    <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>🗂️ จัดการนิเทศสหกิจ (ทั้งหมด)</h2>
                            <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>ตั้งค่าช่วงเวลา จัดการอาจารย์ร่วม และออกหนังสือนิเทศ</div>
                        </div>
                        <button className="btn-ghost" onClick={fetchAll} disabled={allLoading}>{allLoading ? "⏳" : "🔄"} รีเฟรช</button>
                    </div>

                    {/* ── Period Config ── */}
                    <section style={{ ...card, marginBottom: 24, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>⚙️ ตั้งค่าช่วงเวลาการนัดหมายนิเทศ</h3>
                        {selPeriodData && (
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#854d0e', padding: '12px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{ fontSize: 20 }}>📌</span>
                                <div style={{ fontSize: 13 }}>ช่วงเวลาเปิดสหกิจ: <b>{fmtDate(selPeriodData.startDate)}</b> ถึง <b>{fmtDate(selPeriodData.endDate)}</b></div>
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: 15, alignItems: 'end' }}>
                            <div>
                                <label style={labelStyle}>เลือกรอบสหกิจ <span style={{ color: 'red' }}>*</span></label>
                                <select className="input" style={{ fontWeight: 'bold', color: '#0369a1', background: '#f0f9ff' }} value={selPeriodId} onChange={e => selectAllPeriod(Number(e.target.value))}>
                                    <option value="">-- เลือกรอบ --</option>
                                    {allPeriods.map(p => <option key={p.id} value={p.id}>เทอม {p.semester}/{p.academicYear}{p.isActive ? " ⭐" : ""}</option>)}
                                </select>
                            </div>
                            <div><label style={labelStyle}>วันเริ่มนัดหมาย</label><input type="date" lang="th-TH" className="input" value={supStart} onChange={e => setSupStart(e.target.value)} disabled={!selPeriodId} /></div>
                            <div><label style={labelStyle}>วันสิ้นสุด</label><input type="date" lang="th-TH" className="input" value={supEnd} onChange={e => setSupEnd(e.target.value)} disabled={!selPeriodId} /></div>
                            <div>
                                <label style={labelStyle}>สถานะระบบ</label>
                                <select className="input" value={periodOpen ? "OPEN" : "CLOSED"} onChange={e => setPeriodOpen(e.target.value === "OPEN")} disabled={!selPeriodId}>
                                    <option value="CLOSED">🔴 ปิดระบบ</option>
                                    <option value="OPEN">🟢 เปิดระบบ</option>
                                </select>
                            </div>
                            <button className="btn-success" onClick={handleSaveConfig} disabled={savingConfig || !selPeriodId}>{savingConfig ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
                        </div>
                    </section>

                    {/* ── Calendar ── */}
                    <div style={{ marginBottom: 24 }}>
                        <SupervisionCalendar events={allCalendarEvents} title="📅 ปฏิทินนิเทศสหกิจ (ทั้งหมด)" />
                    </div>

                    {/* ── Table ── */}
                    <section style={card}>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#0f172a', flex: 1 }}>รายการนัดหมายนิเทศทั้งหมด ({processedAll.length} รายการ)</h3>
                            <input className="input" placeholder="ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์..." value={allQ} onChange={e => setAllQ(e.target.value)} style={{ width: 280 }} />
                            <select className="input" style={{ width: 'auto' }} value={allPeriodFilter} onChange={e => setAllPeriodFilter(e.target.value)}>
                                <option value="all">📚 ทุกปีการศึกษา</option>
                                {allPeriods.map(p => <option key={p.id} value={p.id}>เทอม {p.semester}/{p.academicYear}</option>)}
                            </select>
                        </div>
                        {allLoading ? <div style={{ textAlign: 'center', padding: 40 }}>กำลังโหลด...</div> : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={tableStyle}>
                                    <thead>
                                        <tr style={thRow}>
                                            <th style={{ ...th, cursor: 'pointer' }} onClick={() => handleAllSort('student')}>รหัส / ชื่อ นศ. <AllSortIcon col="student" /></th>
                                            <th style={{ ...th, cursor: 'pointer' }} onClick={() => handleAllSort('company')}>หน่วยงาน <AllSortIcon col="company" /></th>
                                            <th style={{ ...th, cursor: 'pointer' }} onClick={() => handleAllSort('teacher')}>อาจารย์ผู้นิเทศ <AllSortIcon col="teacher" /></th>
                                            <th style={{ ...th, cursor: 'pointer' }} onClick={() => handleAllSort('datetime')}>วัน-เวลา <AllSortIcon col="datetime" /></th>
                                            <th style={{ ...th, cursor: 'pointer' }} onClick={() => handleAllSort('status')}>สถานะ <AllSortIcon col="status" /></th>
                                            <th style={{ ...th, textAlign: 'center' }}>จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {processedAll.length === 0 ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>ไม่พบรายการ</td></tr>
                                        ) : processedAll.map(sup => (
                                            <tr key={sup.id} style={trStyle}>
                                                <td style={td} data-label="รหัส / ชื่อ">
                                                    <div style={{ fontWeight: 700, color: '#0ea5e9' }}>{sup.student.studentId}</div>
                                                    <div style={{ fontSize: 13, color: '#475569' }}>{sup.student.firstName} {sup.student.lastName}</div>
                                                </td>
                                                <td style={td}><div style={{ fontWeight: 600 }}>{sup.student.coop?.company?.name || "-"}</div></td>
                                                <td style={td}>
                                                    <div style={{ fontSize: 13, fontWeight: 'bold' }}>{sup.teacher ? `${sup.teacher.prefix || ''}${sup.teacher.firstName} ${sup.teacher.lastName}` : '-'}</div>
                                                    {sup.coTeacherName
                                                        ? <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>ร่วม: {sup.coTeacherName}</div>
                                                        : <div style={{ fontSize: 11, marginTop: 4, display: 'inline-block', background: 'rgba(234,179,8,.15)', border: '1px solid rgba(234,179,8,.4)', color: '#b45309', borderRadius: 4, padding: '1px 6px' }}>⚠️ ยังไม่มีอาจารย์ร่วม</div>
                                                    }
                                                </td>
                                                <td style={td}>
                                                    {sup.confirmedDate ? (
                                                        <div style={{ fontWeight: 700, color: '#166634', fontSize: 13 }}>✅ {fmtDateTime(sup.confirmedDate)}</div>
                                                    ) : sup.proposedDates ? (
                                                        <>
                                                            <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, marginBottom: 4 }}>⏳ รออาจารย์เลือก</div>
                                                            {parseProposedList(sup.proposedDates).map((p, i) => (
                                                                <div key={i} style={{ fontSize: 12, color: '#78350f', background: '#fef3c7', padding: '2px 6px', borderRadius: 4, marginBottom: 2 }}>{p.dmy}{p.time ? ` · ${p.time}` : ""}</div>
                                                            ))}
                                                        </>
                                                    ) : <span style={{ color: '#94a3b8', fontSize: 13 }}>ยังไม่เสนอวัน</span>}
                                                </td>
                                                <td style={td}><StatusBadge status={sup.status} /></td>
                                                <td style={{ ...td, textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                        <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px', ...(sup.coTeacherName ? {} : { background: 'rgba(234,179,8,.15)', borderColor: '#d97706', color: '#b45309', fontWeight: 700 }) }} onClick={() => openAssignModal(sup)}>👥 {sup.coTeacherName ? 'อาจารย์ร่วม' : 'มอบหมายอาจารย์ร่วม'}</button>
                                                        {sup.status === "DATE_CONFIRMED" && !sup.officialLetterPath && (
                                                            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px', color: '#d97706', borderColor: '#d97706' }} onClick={() => openEditDateModal(sup)}>✏️ แก้ไขวัน</button>
                                                        )}
                                                        {sup.status === "DATE_CONFIRMED" && (
                                                            <button className="btn" style={{ background: '#2563eb', color: 'white', padding: '6px 10px', fontSize: 12 }} onClick={() => setLetterSup(sup)}>📄 ออกหนังสือ</button>
                                                        )}
                                                        {(sup.status === "LETTER_UPLOADED" || sup.status === "COMPLETED") && sup.officialLetterPath && (
                                                            <button className="btn-ghost" style={{ fontSize: 12, color: '#10b981', borderColor: '#10b981', padding: '6px 10px' }} onClick={() => setLetterSup(sup)}>👁️ ดูเอกสาร</button>
                                                        )}
                                                        {sup.status === "LETTER_UPLOADED" && (
                                                            <button className="btn" style={{ background: '#7c3aed', color: 'white', padding: '6px 10px', fontSize: 12 }} onClick={() => handleAllComplete(sup)}>🏁 จบนิเทศ</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* ── Shared Styles ── */}
            <style>{`
                .input { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box; resize: vertical; }
                .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
                .input:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
                .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.6); display: flex; align-items: center; justify-content: center; z-index: 999; backdrop-filter: blur(4px); }
                .modal-card-split { background: #fff; border-radius: 16px; width: 95vw; height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,.25); }
                .teacher-checkbox-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; max-height: 300px; overflow-y: auto; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
                .teacher-checkbox-label { display: flex; align-items: center; gap: 8px; padding: 8px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 13px; }
                .teacher-checkbox-label:hover { background: #f1f5f9; }
            `}</style>

            {/* ── Modal: Assign Co-teachers ── */}
            {assignSup && (
                <div style={modalOverlay} onClick={() => setAssignSup(null)}>
                    <div style={{ ...modalContent, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
                            <h3 style={{ margin: 0 }}>👥 จัดการอาจารย์นิเทศ</h3>
                            <button onClick={() => setAssignSup(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>นักศึกษา: <b>{assignSup.student.firstName} {assignSup.student.lastName}</b></div>
                            <div style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>บริษัท: <b>{assignSup.student.coop?.company?.name}</b></div>
                            <div style={{ background: '#eff6ff', padding: 12, borderRadius: 8, border: '1px solid #bfdbfe', marginTop: 10 }}>
                                <div style={{ fontSize: 13, color: '#1e40af', fontWeight: 'bold' }}>👑 อาจารย์ที่ปรึกษาหลัก</div>
                                <div style={{ fontSize: 14, color: '#1e3a8a', marginTop: 4 }}>{assignSup.teacher ? `${assignSup.teacher.prefix || ''}${assignSup.teacher.firstName} ${assignSup.teacher.lastName}` : '-'}</div>
                            </div>
                        </div>
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                            <h4 style={{ margin: '0 0 8px 0' }}>เลือกอาจารย์นิเทศร่วม</h4>
                            <div className="teacher-checkbox-grid">
                                {teachersList.filter(t => t.id !== (assignSup as any).teacherId).map(t => {
                                    const fullName = `${t.prefix || ''}${t.firstName} ${t.lastName}`;
                                    const checked = coTeachers.includes(fullName);
                                    return (
                                        <label key={t.id} className="teacher-checkbox-label" style={{ borderColor: checked ? '#3b82f6' : '#cbd5e1', background: checked ? '#eff6ff' : 'white' }}>
                                            <input type="checkbox" checked={checked} onChange={() => toggleCoTeacher(fullName)} style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
                                            <span style={{ fontWeight: checked ? 'bold' : 'normal', color: checked ? '#1e40af' : '#334155' }}>{fullName}</span>
                                        </label>
                                    );
                                })}
                                {teachersList.length <= 1 && <div style={{ gridColumn: '1 / -1', color: '#94a3b8', textAlign: 'center', padding: 20 }}>ไม่มีอาจารย์ท่านอื่น</div>}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                            <button className="btn-ghost" onClick={() => setAssignSup(null)}>ยกเลิก</button>
                            <button className="btn" style={{ background: '#2563eb', padding: '10px 20px' }} onClick={handleSaveCoTeachers}>💾 บันทึก</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Edit Date ── */}
            {editDateSup && (
                <div style={modalOverlay} onClick={() => setEditDateSup(null)}>
                    <div style={{ ...modalContent, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0 }}>✏️ แก้ไขวัน-เวลานิเทศ</h3>
                            <button onClick={() => setEditDateSup(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
                        </div>
                        <div style={{ fontSize: 14, color: '#475569', marginBottom: 20, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                            <div>นักศึกษา: <b>{editDateSup.student.firstName} {editDateSup.student.lastName}</b></div>
                            <div style={{ marginTop: 4 }}>บริษัท: <b>{editDateSup.student.coop?.company?.name || '-'}</b></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                            <div><label style={labelStyle}>วันที่นิเทศ *</label><input type="date" lang="th-TH" className="input" value={editDateVal} onChange={e => setEditDateVal(e.target.value)} /></div>
                            <div><label style={labelStyle}>เวลา *</label><input type="time" className="input" value={editDateTime} onChange={e => setEditDateTime(e.target.value)} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button className="btn-ghost" onClick={() => setEditDateSup(null)}>ยกเลิก</button>
                            <button className="btn" style={{ background: '#d97706', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }} disabled={!editDateVal || savingDate} onClick={() => setConfirmEditOpen(true)}>
                                {savingDate ? <><Spinner size={16} color="#fff" /> กำลังบันทึก...</> : '💾 บันทึกวันใหม่'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog open={confirmEditOpen} title="ยืนยันการแก้ไขวันนิเทศ" message={`เปลี่ยนวันนิเทศเป็น ${editDateVal} เวลา ${editDateTime} น.?`} icon="✏️" confirmLabel="บันทึก" confirmColor="#d97706" onConfirm={handleSaveEditDate} onCancel={() => setConfirmEditOpen(false)} />

            {/* ══════════════════ TAB: นิเทศตามบริษัท ══════════════════ */}
            {activeTab === 'group' && <T_GroupSupervision />}

            {/* ── Modal: Issue Letter ── */}
            {letterSup && !assignSup && (
                <IssueSupervisionLetterModal
                    supervision={letterSup as any}
                    onClose={() => setLetterSup(null)}
                    onSuccess={() => { setLetterSup(null); fetchAll(); }}
                />
            )}
        </div>
    );
}

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", padding: "8px 0", borderBottom: "1px dashed #e2e8f0", fontSize: 14 }}>
        <div style={{ color: "#64748b", fontWeight: 600 }}>{label}:</div>
        <div style={{ color: "#1e293b", fontWeight: 700 }}>{value}</div>
    </div>
);

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" };
const labelStyle: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thRow: CSSProperties = { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" };
const th: CSSProperties = { padding: "14px 16px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#64748b", userSelect: "none" };
const trStyle: CSSProperties = { borderBottom: "1px solid #f1f5f9" };
const td: CSSProperties = { padding: "14px 16px", verticalAlign: "middle", fontSize: 14 };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContent: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, width: "95%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", maxHeight: '90vh', overflowY: 'auto' };
