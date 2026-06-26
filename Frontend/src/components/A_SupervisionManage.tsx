import React, { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import IssueSupervisionLetterModal from "./IssueSupervisionLetterModal";
import StatusBadge from "./StatusBadge";
import SupervisionCalendar from "./SupervisionCalendar";
import type { CalendarEvent } from "./SupervisionCalendar";
import { useToast } from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import Spinner from "./Spinner";

// --- Types ---
type SupervisionStatus = "PENDING_TEACHER" | "TEACHER_REJECTED" | "DATE_CONFIRMED" | "LETTER_UPLOADED" | "COMPLETED";

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
    prefix: string;
    firstName: string;
    lastName: string;
}

// แปลง proposedDates JSON string → array แล้ว format แต่ละวัน
function parseProposedList(raw: string): { dmy: string; time: string }[] {
    try {
        const arr: string[] = JSON.parse(raw || "[]");
        return arr.map(entry => {
            const [dPart = "", tPart = ""] = entry.includes("|") ? entry.split("|") : [entry, ""];
            const d = new Date(dPart);
            const dmy = isNaN(d.getTime()) ? dPart : `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()+543}`;
            return { dmy, time: tPart || "" };
        });
    } catch { return []; }
}

interface Supervision {
    id: number;
    studentId: number;
    teacherId: number;
    coopPeriodId?: number;
    proposedDates: string;
    supervisionType: "ONLINE" | "ONSITE";
    confirmedDate: string | null;
    coTeacherName?: string | null;
    status: SupervisionStatus;
    officialLetterPath: string | null;
    onlineLink?: string | null;
    student: {
        studentId: string;
        firstName: string;
        lastName: string;
        coopPeriodId?: number;
        coop: {
            company: { name: string; address: string; };
            coopPeriodId?: number; // 🟢 เพิ่มบรรทัดนี้เพื่อให้ TypeScript เข้าถึงได้
        };
    };
    teacher: Teacher;
}

// 🟢 Types สำหรับการเรียงลำดับ (Sorting)
type SortKey = 'student' | 'company' | 'teacher' | 'datetime' | 'status';
type SortDirection = 'asc' | 'desc';

export default function A_SupervisionManage() {
    const toast = useToast();
    const [supervisions, setSupervisions] = useState<Supervision[]>([]);
    const [teachersList, setTeachersList] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);

    // Config State
    const [coopPeriods, setCoopPeriods] = useState<CoopPeriod[]>([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState<number | "">("");

    const [periodOpen, setPeriodOpen] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [savingConfig, setSavingConfig] = useState(false);

    // Modals State
    const [selectedSupForModal, setSelectedSupForModal] = useState<Supervision | null>(null);
    const [assignTeacherModalOpen, setAssignTeacherModalOpen] = useState(false);
    const [selectedCoTeachers, setSelectedCoTeachers] = useState<string[]>([]);

    // Edit confirmed date modal
    const [editDateSup, setEditDateSup] = useState<Supervision | null>(null);
    const [editDateValue, setEditDateValue] = useState("");
    const [editDateTime, setEditDateTime] = useState("09:00");
    const [savingDate, setSavingDate] = useState(false);
    const [confirmEditOpen, setConfirmEditOpen] = useState(false);

    const token = localStorage.getItem("coop.token");

    // State สำหรับค้นหาและกรองตาราง
    const [q, setQ] = useState("");
    const [filterPeriodId, setFilterPeriodId] = useState<string>("all");
    const [filterCompany, setFilterCompany] = useState<string>("all");

    // State สำหรับการเรียงลำดับ (Sorting)
    const [sortKey, setSortKey] = useState<SortKey>('student');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. ดึงรอบสหกิจศึกษาทั้งหมด
            const periodRes = await axios.get("/api/admin/supervision-periods", {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (periodRes.data?.periods) {
                const periods: CoopPeriod[] = periodRes.data.periods;
                setCoopPeriods(periods);
                const activePeriod = periods.find(p => p.isActive === true);
                if (activePeriod) {
                    handleSelectPeriod(activePeriod.id, periods);
                } else if (periods.length > 0) {
                    handleSelectPeriod(periods[0].id, periods);
                }
            }

            // 2. ดึงรายชื่อการนิเทศ
            const supRes = await axios.get("/api/admin/supervisions", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (supRes.data?.supervisions) setSupervisions(supRes.data.supervisions);

            // 3. ดึงรายชื่ออาจารย์ทั้งหมด (สำหรับเลือกอาจารย์นิเทศร่วม)
            const teacherRes = await axios.get("/api/teachers", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (teacherRes.data?.teachers) {
                setTeachersList(teacherRes.data.teachers);
            } else if (teacherRes.data?.data) {
                setTeachersList(teacherRes.data.data);
            } else if (Array.isArray(teacherRes.data)) {
                setTeachersList(teacherRes.data);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSelectPeriod = (id: number, periodsList = coopPeriods) => {
        setSelectedPeriodId(id);
        const period = periodsList.find(p => p.id === id);
        if (period) {
            setPeriodOpen(period.isSupervisionOpen || false);
            setStartDate(period.supervisionStartDate ? period.supervisionStartDate.split('T')[0] : "");
            setEndDate(period.supervisionEndDate ? period.supervisionEndDate.split('T')[0] : "");
        }
    };

    const handleSaveConfig = async () => {
        if (!selectedPeriodId) { toast.warning("กรุณาเลือกรอบสหกิจศึกษาก่อน"); return; }
        setSavingConfig(true);
        try {
            await axios.post("/api/admin/supervision-periods", {
                periodId: selectedPeriodId,
                isSupervisionOpen: periodOpen,
                supervisionStartDate: startDate || null,
                supervisionEndDate: endDate || null
            }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("บันทึกช่วงเวลานิเทศเรียบร้อยแล้ว");
            fetchData();
        } catch {
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setSavingConfig(false);
        }
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

    // กรองตารางและเรียงลำดับ (Filter & Sort)
    const processedSupervisions = useMemo(() => {
        let filtered = supervisions.filter(sup => {
            const searchStr = `${sup.student.studentId} ${sup.student.firstName} ${sup.student.lastName} ${sup.student.coop?.company?.name || ""} ${sup.teacher?.firstName || ""} ${sup.teacher?.lastName || ""}`.toLowerCase();
            const matchesQ = searchStr.includes(q.toLowerCase());

            const pIdFromSup = sup.coopPeriodId;
            const pIdFromStudent = sup.student?.coopPeriodId;
            const pIdFromCoop = sup.student?.coop?.coopPeriodId;
            const supPeriodId = String(pIdFromSup || pIdFromStudent || pIdFromCoop || "");
            const matchesPeriod = filterPeriodId === "all" || supPeriodId === String(filterPeriodId);

            const matchesCompany = filterCompany === "all" || sup.student.coop?.company?.name === filterCompany;

            return matchesQ && matchesPeriod && matchesCompany;
        });

        // 2. Sort
        filtered.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            switch (sortKey) {
                case 'student':
                    valA = a.student.studentId; valB = b.student.studentId; break;
                case 'company':
                    valA = a.student.coop?.company?.name || ''; valB = b.student.coop?.company?.name || ''; break;
                case 'teacher':
                    valA = a.teacher.firstName; valB = b.teacher.firstName; break;
                case 'datetime':
                    valA = a.confirmedDate || a.proposedDates; valB = b.confirmedDate || b.proposedDates; break;
                case 'status':
                    valA = a.status; valB = b.status; break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [supervisions, q, filterPeriodId, sortKey, sortDirection]);

    // ─── handleEditDate ─────────────────────────────────────────
    const openEditDateModal = (sup: Supervision) => {
        setEditDateSup(sup);
        if (sup.confirmedDate) {
            const d = new Date(sup.confirmedDate);
            setEditDateValue(d.toISOString().split('T')[0]);
            setEditDateTime(d.toTimeString().slice(0, 5));
        } else {
            setEditDateValue("");
            setEditDateTime("09:00");
        }
    };

    const handleComplete = async (sup: Supervision) => {
        if (!confirm("ยืนยันว่าการนิเทศเสร็จสิ้นแล้ว?")) return;
        try {
            await axios.put(`/api/admin/supervisions/${sup.id}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("บันทึกผลนิเทศเสร็จสิ้นสำเร็จ");
            fetchData();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก");
        }
    };

    const handleSaveEditDate = async () => {
        if (!editDateSup || !editDateValue) return;
        setSavingDate(true);
        setConfirmEditOpen(false);
        try {
            const iso = new Date(`${editDateValue}T${editDateTime}:00`).toISOString();
            await axios.put(
                `/api/admin/supervisions/${editDateSup.id}/confirmed-date`,
                { confirmedDate: iso },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("แก้ไขวันนิเทศเรียบร้อยแล้ว");
            setEditDateSup(null);
            fetchData();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "เกิดข้อผิดพลาด");
        } finally {
            setSavingDate(false);
        }
    };

    // ─── unique company list ─────────────────────────────────────
    const companyList = useMemo(() => {
        const names = supervisions
            .map(s => s.student.coop?.company?.name)
            .filter((n): n is string => !!n);
        return [...new Set(names)].sort();
    }, [supervisions]);

    // ─── ฟังก์ชันเปิด Modal จัดการอาจารย์
    const openAssignTeacherModal = (sup: Supervision) => {
        setSelectedSupForModal(sup);
        // แปลง string ชื่ออาจารย์ร่วม ให้เป็น array เพื่อนำไปติ๊กถูกใน checkbox
        if (sup.coTeacherName) {
            setSelectedCoTeachers(sup.coTeacherName.split(',').map(name => name.trim()));
        } else {
            setSelectedCoTeachers([]);
        }
        setAssignTeacherModalOpen(true);
    };

    // 🟢 ติ๊กเลือก/เอาออก อาจารย์นิเทศร่วม
    const toggleCoTeacher = (teacherFullName: string) => {
        setSelectedCoTeachers(prev =>
            prev.includes(teacherFullName)
                ? prev.filter(t => t !== teacherFullName)
                : [...prev, teacherFullName]
        );
    };

    // 🟢 บันทึกอาจารย์นิเทศร่วมลง DB
    const handleSaveCoTeachers = async () => {
        if (!selectedSupForModal) return;
        try {
            // รวมชื่ออาจารย์ที่เลือกด้วยลูกน้ำ
            const coTeacherString = selectedCoTeachers.length > 0 ? selectedCoTeachers.join(', ') : null;

            await axios.put(`/api/admin/supervisions/${selectedSupForModal.id}/co-teachers`, {
                coTeacherName: coTeacherString
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success("บันทึกรายชื่ออาจารย์นิเทศเรียบร้อยแล้ว");
            setAssignTeacherModalOpen(false);
            fetchData();
        } catch {
            toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูลอาจารย์นิเทศ");
        }
    };

    const selectedPeriodData = coopPeriods.find(p => p.id === selectedPeriodId);

    // UI HELPER: แสดงลูกศรเรียงลำดับ
    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <span style={{ color: '#cbd5e1', marginLeft: 4 }}>↕</span>;
        return <span style={{ color: '#0ea5e9', marginLeft: 4 }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    // แปลง supervisions → CalendarEvent (เฉพาะที่ยืนยันวันแล้ว)
    const calendarEvents = useMemo<CalendarEvent[]>(() =>
        supervisions
            .filter(s => s.confirmedDate && ["DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"].includes(s.status))
            .map(s => ({
                id: s.id,
                confirmedDate: s.confirmedDate!,
                studentId: s.student.studentId,
                studentName: `${s.student.firstName} ${s.student.lastName}`,
                type: s.supervisionType,
                status: s.status,
                companyName: s.student.coop?.company?.name,
                onlineLink: s.onlineLink ?? null,
            })),
        [supervisions]
    );

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูล...</div>;

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>🚗 จัดการการนิเทศสหกิจศึกษา</h2>
                <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>เปิด-ปิดช่วงเวลาการนิเทศ และจัดการอาจารย์นิเทศร่วม</div>
            </div>

            {/* ================= SECTION 1: CONFIG ผูกกับ COOP PERIOD ================= */}
            <section style={{ ...card, marginBottom: 24, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>⚙️</span> ตั้งค่าช่วงเวลาการนัดหมายนิเทศ
                    </h3>
                </div>

                {selectedPeriodData && (
                    <div style={{
                        background: '#fffbeb', border: '1px solid #fde68a', color: '#854d0e',
                        padding: '12px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center'
                    }}>
                        <span style={{ fontSize: 24 }}>📌</span>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: 14 }}>ช่วงเวลาเปิดสหกิจ</div>
                            <div style={{ fontSize: 13, marginTop: 2 }}>
                                ตั้งแต่วันที่ <b>{new Date(selectedPeriodData.startDate).toLocaleDateString('th-TH', { dateStyle: 'long' })}</b> ถึง <b>{new Date(selectedPeriodData.endDate).toLocaleDateString('th-TH', { dateStyle: 'long' })}</b>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: 15, alignItems: 'end' }}>
                    <div>
                        <label style={labelStyle}>เลือกรอบสหกิจศึกษา <span style={{ color: 'red' }}>*</span></label>
                        <select className="input" style={{ fontWeight: 'bold', color: '#0369a1', background: '#f0f9ff' }}
                            value={selectedPeriodId} onChange={e => handleSelectPeriod(Number(e.target.value))}>
                            <option value="">-- เลือกรอบที่ต้องการ --</option>
                            {coopPeriods.map(p => (
                                <option key={p.id} value={p.id}>
                                    เทอม {p.semester}/{p.academicYear} {p.isActive ? " ⭐ (รอบปัจจุบัน)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={labelStyle}>วันเริ่มนัดหมายนิเทศ</label>
                        <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={!selectedPeriodId} />
                    </div>
                    <div>
                        <label style={labelStyle}>วันสิ้นสุดนัดหมาย</label>
                        <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={!selectedPeriodId} />
                    </div>
                    <div>
                        <label style={labelStyle}>สถานะระบบนัดหมาย</label>
                        <select className="input" value={periodOpen ? "OPEN" : "CLOSED"} onChange={e => setPeriodOpen(e.target.value === "OPEN")} disabled={!selectedPeriodId}>
                            <option value="CLOSED">🔴 ปิดระบบ</option>
                            <option value="OPEN">🟢 เปิดระบบให้จอง</option>
                        </select>
                    </div>
                    <button className="btn" style={{ background: '#10b981', height: 42, padding: '0 20px' }}
                        onClick={handleSaveConfig} disabled={savingConfig || !selectedPeriodId}>
                        {savingConfig ? "กำลังบันทึก..." : "💾 บันทึก"}
                    </button>
                </div>
            </section>

            {/* ================= ปฏิทินนิเทศ ================= */}
            <div style={{ marginBottom: 24 }}>
                <SupervisionCalendar events={calendarEvents} title="📅 ปฏิทินนิเทศสหกิจ (วันที่ยืนยันแล้ว)" />
            </div>

            {/* ================= SECTION 2: รายการนิเทศ ================= */}
            <section style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: '#0f172a' }}>รายการนัดหมายนิเทศทั้งหมด</h3>
                    <button className="btn-ghost" onClick={fetchData}>🔄 รีเฟรช</button>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    <input
                        className="input"
                        placeholder="ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์..."
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        style={{ flex: 1, minWidth: 220 }}
                    />
                    <select className="input" style={{ width: 'auto' }} value={filterPeriodId} onChange={e => setFilterPeriodId(e.target.value)}>
                        <option value="all">📚 ทุกปีการศึกษา</option>
                        {coopPeriods.map(p => (
                            <option key={p.id} value={p.id}>เทอม {p.semester}/{p.academicYear}</option>
                        ))}
                    </select>
                    <select className="input" style={{ width: 'auto' }} value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
                        <option value="all">🏢 ทุกบริษัท</option>
                        {companyList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={thRow}>
                                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('student')}>
                                    รหัส / ชื่อ นศ. <SortIcon columnKey="student" />
                                </th>
                                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('company')}>
                                    หน่วยงานที่ไปนิเทศ <SortIcon columnKey="company" />
                                </th>
                                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('teacher')}>
                                    อาจารย์ผู้นิเทศ <SortIcon columnKey="teacher" />
                                </th>
                                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('datetime')}>
                                    วัน-เวลา และรูปแบบ <SortIcon columnKey="datetime" />
                                </th>
                                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>
                                    สถานะ <SortIcon columnKey="status" />
                                </th>
                                <th style={{ ...th, textAlign: 'center' }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedSupervisions.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>ไม่พบรายการนัดหมายนิเทศที่ตรงกับเงื่อนไข</td></tr>
                            ) : processedSupervisions.map(sup => (
                                <tr key={sup.id} style={trStyle}>
                                    <td style={td}>
                                        <div style={{ fontWeight: 700, color: '#0ea5e9' }}>{sup.student.studentId}</div>
                                        <div style={{ fontSize: 13, color: '#475569' }}>{sup.student.firstName} {sup.student.lastName}</div>
                                    </td>
                                    <td style={td}>
                                        <div style={{ fontWeight: 600 }}>{sup.student.coop?.company?.name || "-"}</div>
                                    </td>
                                    <td style={td}>
                                        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b' }}>
                                            อาจารย์ที่ปรึกษา {sup.teacher.prefix}{sup.teacher.firstName} {sup.teacher.lastName}
                                        </div>
                                        {sup.coTeacherName && (
                                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                                อาจารย์นิเทศร่วม: {sup.coTeacherName}
                                            </div>
                                        )}
                                    </td>
                                    <td style={td}>
                                        {sup.confirmedDate ? (
                                            <>
                                                <div style={{ fontWeight: 700, color: '#166534', fontSize: 13 }}>
                                                    ✅ {new Date(sup.confirmedDate).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} น.
                                                </div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                                    {sup.supervisionType === 'ONLINE' ? '🌐 ออนไลน์' : '🏢 ออนไซต์'}
                                                </div>
                                            </>
                                        ) : sup.proposedDates ? (
                                            <>
                                                <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, marginBottom: 4 }}>⏳ วันที่เสนอ (รออาจารย์เลือก)</div>
                                                {parseProposedList(sup.proposedDates).map((p, i) => (
                                                    <div key={i} style={{ fontSize: 12, color: '#78350f', background: '#fef3c7', padding: '2px 6px', borderRadius: 4, marginBottom: 2 }}>
                                                        {p.dmy}{p.time ? ` · ${p.time}` : ""}
                                                    </div>
                                                ))}
                                            </>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: 13 }}>ยังไม่เสนอวัน</span>
                                        )}
                                    </td>
                                    <td style={td}>
                                        <StatusBadge status={sup.status} />
                                    </td>
                                    <td style={{ ...td, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                                            {/* ปุ่มเลือกอาจารย์นิเทศร่วม */}
                                            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => openAssignTeacherModal(sup)}>
                                                👥 จัดการอาจารย์
                                            </button>

                                            {/* ปุ่มจัดการเอกสาร */}
                                            {sup.status === "DATE_CONFIRMED" && !sup.officialLetterPath && (
                                                <button
                                                    className="btn-ghost"
                                                    style={{ fontSize: 12, padding: '6px 10px', color: '#d97706', borderColor: '#d97706' }}
                                                    onClick={() => openEditDateModal(sup)}
                                                >
                                                    ✏️ แก้ไขวัน
                                                </button>
                                            )}
                                            {sup.status === "DATE_CONFIRMED" && (
                                                <button className="btn" style={{ background: '#2563eb', color: 'white', padding: '6px 10px', fontSize: 12 }} onClick={() => setSelectedSupForModal(sup)}>
                                                    📄 ออกหนังสือ
                                                </button>
                                            )}
                                            {(sup.status === "LETTER_UPLOADED" || sup.status === "COMPLETED") && sup.officialLetterPath && (
                                                <button className="btn-ghost" style={{ fontSize: 12, color: '#10b981', borderColor: '#10b981', padding: '6px 10px' }} onClick={() => setSelectedSupForModal(sup)}>
                                                    👁️ ดูเอกสาร
                                                </button>
                                            )}
                                            {sup.status === "LETTER_UPLOADED" && (
                                                <button className="btn" style={{ background: '#7c3aed', color: 'white', padding: '6px 10px', fontSize: 12 }} onClick={() => handleComplete(sup)}>
                                                    🏁 จบนิเทศ
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <style>{`
                .btn { border-radius: 8px; border: none; font-weight: 700; color: white; cursor: pointer; transition: 0.2s; display: inline-block; }
                .btn:hover:not(:disabled) { opacity: 0.8; }
                .btn:disabled { background: #cbd5e1 !important; cursor: not-allowed; }
                .btn-ghost { padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; background: #fff; cursor: pointer; transition: 0.2s; }
                .btn-ghost:hover { background: #f1f5f9; }
                .input { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box; }
                .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); }
                .input:disabled { background-color: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
                
                .teacher-checkbox-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; max-height: 300px; overflow-y: auto; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;}
                .teacher-checkbox-label { display: flex; alignItems: center; gap: 8px; padding: 8px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 13px;}
                .teacher-checkbox-label:hover { background: #f1f5f9; border-color: #94a3b8;}
            `}</style>

            {/* ================= ConfirmDialog: ยืนยันแก้ไขวัน ================= */}
            <ConfirmDialog
                open={confirmEditOpen}
                title="ยืนยันการแก้ไขวันนิเทศ"
                message={`เปลี่ยนวันนิเทศเป็น ${editDateValue} เวลา ${editDateTime} น.?`}
                icon="✏️"
                confirmLabel="บันทึก"
                confirmColor="#d97706"
                onConfirm={handleSaveEditDate}
                onCancel={() => setConfirmEditOpen(false)}
            />

            {/* ================= MODAL: แก้ไขวันนิเทศ ================= */}
            {editDateSup && (
                <div style={modalOverlay} onClick={() => setEditDateSup(null)}>
                    <div style={{ ...modalContentLarge, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>✏️ แก้ไขวัน-เวลานิเทศ</h3>
                            <button onClick={() => setEditDateSup(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>
                        <div style={{ fontSize: 14, color: '#475569', marginBottom: 20, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                            <div>นักศึกษา: <b>{editDateSup.student.firstName} {editDateSup.student.lastName}</b></div>
                            <div style={{ marginTop: 4 }}>บริษัท: <b>{editDateSup.student.coop?.company?.name || '-'}</b></div>
                            <div style={{ marginTop: 4 }}>อาจารย์: <b>{editDateSup.teacher.prefix}{editDateSup.teacher.firstName} {editDateSup.teacher.lastName}</b></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                            <div>
                                <label style={labelStyle}>วันที่นิเทศ *</label>
                                <input type="date" className="input" value={editDateValue} onChange={e => setEditDateValue(e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>เวลา *</label>
                                <input type="time" className="input" value={editDateTime} onChange={e => setEditDateTime(e.target.value)} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button className="btn-ghost" onClick={() => setEditDateSup(null)}>ยกเลิก</button>
                            <button
                                className="btn"
                                style={{ background: '#d97706', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}
                                disabled={!editDateValue || savingDate}
                                onClick={() => setConfirmEditOpen(true)}
                            >
                                {savingDate ? <><Spinner size={16} color="#fff" /> กำลังบันทึก...</> : '💾 บันทึกวันใหม่'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= MODAL: ออกเอกสาร ================= */}
            {selectedSupForModal && !assignTeacherModalOpen && (
                <IssueSupervisionLetterModal
                    supervision={selectedSupForModal}
                    onClose={() => setSelectedSupForModal(null)}
                    onSuccess={() => {
                        setSelectedSupForModal(null);
                        fetchData();
                    }}
                />
            )}

            {/* ================= 🟢 MODAL: จัดการอาจารย์นิเทศร่วม ================= */}
            {assignTeacherModalOpen && selectedSupForModal && (
                <div style={modalOverlay}>
                    <div style={{ ...modalContentLarge, maxWidth: 600 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>👥 จัดการอาจารย์นิเทศ</h3>
                            <button onClick={() => { setAssignTeacherModalOpen(false); setSelectedSupForModal(null); }} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 14, color: '#475569', marginBottom: 6 }}>นักศึกษา: <b>{selectedSupForModal.student.firstName} {selectedSupForModal.student.lastName}</b></div>
                            <div style={{ fontSize: 14, color: '#475569', marginBottom: 6 }}>บริษัท: <b>{selectedSupForModal.student.coop?.company?.name}</b></div>
                            <div style={{ background: '#eff6ff', padding: 12, borderRadius: 8, border: '1px solid #bfdbfe', marginTop: 10 }}>
                                <div style={{ fontSize: 13, color: '#1e40af', fontWeight: 'bold' }}>👑 อาจารย์ที่ปรึกษาหลัก (ไม่สามารถเปลี่ยนได้ที่นี่)</div>
                                <div style={{ fontSize: 14, color: '#1e3a8a', marginTop: 4 }}>{selectedSupForModal.teacher.prefix}{selectedSupForModal.teacher.firstName} {selectedSupForModal.teacher.lastName}</div>
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                            <h4 style={{ margin: '0 0 8px 0', color: '#334155' }}>เลือกอาจารย์นิเทศร่วม (ถ้ามี)</h4>
                            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>สามารถเลือกอาจารย์ท่านอื่นเพื่อไปนิเทศร่วมได้มากกว่า 1 ท่าน</p>

                            <div className="teacher-checkbox-grid">
                                {teachersList
                                    // กรองอาจารย์หลักออกไปก่อน จะได้ไม่เลือกซ้ำ
                                    .filter(t => t.id !== selectedSupForModal.teacherId)
                                    .map(t => {
                                        const fullName = `${t.prefix || ''}${t.firstName} ${t.lastName}`;
                                        const isChecked = selectedCoTeachers.includes(fullName);
                                        return (
                                            <label key={t.id} className="teacher-checkbox-label" style={{ borderColor: isChecked ? '#3b82f6' : '#cbd5e1', background: isChecked ? '#eff6ff' : 'white' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleCoTeacher(fullName)}
                                                    style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                                                />
                                                <span style={{ fontWeight: isChecked ? 'bold' : 'normal', color: isChecked ? '#1e40af' : '#334155' }}>
                                                    {fullName}
                                                </span>
                                            </label>
                                        );
                                    })
                                }
                                {teachersList.length <= 1 && (
                                    <div style={{ gridColumn: '1 / -1', color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>ไม่มีรายชื่ออาจารย์ท่านอื่นในระบบ</div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                            <button className="btn-ghost" onClick={() => { setAssignTeacherModalOpen(false); setSelectedSupForModal(null); }}>ยกเลิก</button>
                            <button className="btn" style={{ background: '#2563eb', padding: '10px 20px' }} onClick={handleSaveCoTeachers}>💾 บันทึกการเปลี่ยนแปลง</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const labelStyle: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thRow: CSSProperties = { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" };
const th: CSSProperties = { padding: "14px 16px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#64748b" };
const trStyle: CSSProperties = { borderBottom: "1px solid #f1f5f9" };
const td: CSSProperties = { padding: "14px 16px", verticalAlign: "middle", fontSize: 14 };

const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContentLarge: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, width: "95%", maxWidth: 1200, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", overflow: 'hidden' };