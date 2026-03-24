import React, { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import IssueSupervisionLetterModal from "./IssueSupervisionLetterModal";
import StatusBadge from "./StatusBadge";

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
    const [supervisions, setSupervisions] = useState<Supervision[]>([]);
    const [teachersList, setTeachersList] = useState<Teacher[]>([]); // 🟢 เก็บรายชื่ออาจารย์ทั้งหมด
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
    const [selectedCoTeachers, setSelectedCoTeachers] = useState<string[]>([]); // เก็บชื่ออาจารย์ร่วมที่ถูกเลือก

    const token = localStorage.getItem("coop.token");

    // State สำหรับค้นหาและกรองตาราง
    const [q, setQ] = useState("");
    const [filterPeriodId, setFilterPeriodId] = useState<string>("all");

    // 🟢 State สำหรับการเรียงลำดับ (Sorting)
    const [sortKey, setSortKey] = useState<SortKey>('student');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. ดึงรอบสหกิจศึกษาทั้งหมด
            const periodRes = await axios.get("http://localhost:5000/api/admin/supervision-periods", {
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
            const supRes = await axios.get("http://localhost:5000/api/admin/supervisions", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (supRes.data?.supervisions) setSupervisions(supRes.data.supervisions);

            // 3. ดึงรายชื่ออาจารย์ทั้งหมด (สำหรับเลือกอาจารย์นิเทศร่วม)
            const teacherRes = await axios.get("http://localhost:5000/api/teachers", {
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
        if (!selectedPeriodId) return alert("กรุณาเลือกรอบสหกิจศึกษาก่อน");
        setSavingConfig(true);
        try {
            await axios.post("http://localhost:5000/api/admin/supervision-periods", {
                periodId: selectedPeriodId,
                isSupervisionOpen: periodOpen,
                supervisionStartDate: startDate || null,
                supervisionEndDate: endDate || null
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert("บันทึกช่วงเวลานิเทศเรียบร้อยแล้ว");
            fetchData();
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการบันทึก");
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

    // 🟢 กรองตารางและเรียงลำดับ (Filter & Sort)
    const processedSupervisions = useMemo(() => {
        // 1. Filter
        let filtered = supervisions.filter(sup => {
            const searchStr = `${sup.student.studentId} ${sup.student.firstName} ${sup.student.lastName} ${sup.student.coop?.company?.name || ""} ${sup.teacher?.firstName || ""} ${sup.teacher?.lastName || ""}`.toLowerCase();
            const matchesQ = searchStr.includes(q.toLowerCase());

            // ดักจับ ID ปีการศึกษา (ใส่ ?. ทุกจุดที่อาจจะเป็น null)
            const pIdFromSup = sup.coopPeriodId;
            const pIdFromStudent = sup.student?.coopPeriodId;
            const pIdFromCoop = sup.student?.coop?.coopPeriodId; // 🟢 ตอนนี้ TypeScript จะไม่ฟ้อง Error แล้ว

            const supPeriodId = String(pIdFromSup || pIdFromStudent || pIdFromCoop || "");
            const matchesPeriod = filterPeriodId === "all" || supPeriodId === String(filterPeriodId);

            return matchesQ && matchesPeriod;
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

    // 🟢 ฟังก์ชันเปิด Modal จัดการอาจารย์
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

            await axios.put(`http://localhost:5000/api/admin/supervisions/${selectedSupForModal.id}/co-teachers`, {
                coTeacherName: coTeacherString
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert("✅ บันทึกรายชื่ออาจารย์นิเทศเรียบร้อยแล้ว");
            setAssignTeacherModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลอาจารย์นิเทศ");
        }
    };

    const selectedPeriodData = coopPeriods.find(p => p.id === selectedPeriodId);

    // UI HELPER: แสดงลูกศรเรียงลำดับ
    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <span style={{ color: '#cbd5e1', marginLeft: 4 }}>↕</span>;
        return <span style={{ color: '#0ea5e9', marginLeft: 4 }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

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
                        style={{ width: 320 }}
                    />
                    <select
                        className="input"
                        style={{ width: 'auto', background: '#f8fafc' }}
                        value={filterPeriodId}
                        onChange={e => setFilterPeriodId(e.target.value)}
                    >
                        <option value="all">📚 ทุกปีการศึกษา</option>
                        {coopPeriods.map(p => (
                            <option key={p.id} value={p.id}>เทอม {p.semester}/{p.academicYear}</option>
                        ))}
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
                                        {sup.status === 'PENDING_TEACHER' ? (
                                            <span style={{ color: '#d97706', fontSize: 13 }}>⏳ รออาจารย์เลือกวัน</span>
                                        ) : sup.confirmedDate ? (
                                            <>
                                                <div style={{ fontWeight: 700, color: '#166534', fontSize: 13 }}>
                                                    {new Date(sup.confirmedDate).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} น.
                                                </div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                                    {sup.supervisionType === 'ONLINE' ? '🌐 ออนไลน์' : '🏢 ออนไซต์'}
                                                </div>
                                            </>
                                        ) : (
                                            <span style={{ color: '#dc2626', fontSize: 13 }}>ไม่ระบุ</span>
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
                            <button onClick={() => setAssignTeacherModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
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
                            <button className="btn-ghost" onClick={() => setAssignTeacherModalOpen(false)}>ยกเลิก</button>
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