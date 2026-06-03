import React, { useState, useEffect } from "react";
import axios from "axios";
import StatusBadge from "./StatusBadge";
import SupervisionCalendar from "./SupervisionCalendar";
import type { CalendarEvent } from "./SupervisionCalendar";

// --- Types ---
type SupervisionStatus =
    | "PENDING_TEACHER"
    | "TEACHER_REJECTED"
    | "DATE_CONFIRMED"
    | "LETTER_UPLOADED"
    | "COMPLETED";

interface SupervisionAppt {
    id: number;
    proposedDates: string;
    supervisionType: "ONLINE" | "ONSITE";
    onlineLink?: string | null;
    coTeacherName?: string | null;
    confirmedDate: string | null;
    rejectReason: string | null;
    status: SupervisionStatus;
    officialLetterPath: string | null;
    teacher?: {
        prefix: string;
        firstName: string;
        lastName: string;
    };
}

interface CoopPeriod {
    academicYear: string;
    semester: string;
    supervisionStartDate: string | null;
    supervisionEndDate: string | null;
    isSupervisionOpen: boolean;
}

export default function S_Supervision() {
    const [loading, setLoading] = useState(true);
    const [coopStatus, setCoopStatus] = useState<string>("NOT_SUBMITTED");
    const [appointment, setAppointment] = useState<SupervisionAppt | null>(null);
    const [advisorName, setAdvisorName] = useState<string>("-");

    const [activePeriod, setActivePeriod] = useState<CoopPeriod | null>(null);

    // Form State
    const [dates, setDates] = useState<string[]>([""]);
    const [supType, setSupType] = useState<"ONLINE" | "ONSITE">("ONLINE");
    const [onlineLink, setOnlineLink] = useState<string>("");

    const [isEditing, setIsEditing] = useState(false);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

    const token = localStorage.getItem("coop.token");

    const timeOptions = [
        "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
        "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
        "16:00", "16:30", "17:00"
    ];

    const formatDateTime24 = (dateString: string) => {
        return new Date(dateString).toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).replace(':', '.');
    };

    const formatProposedDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const [dPart, tPart] = dateStr.includes('|') ? dateStr.split('|') : [dateStr, ""];
        const formattedDate = new Date(dPart).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
        return `${formattedDate} ${tPart ? `เวลา ${tPart.replace(':', '.')} น.` : ''}`;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Profile Status & Advisor
            const profileRes = await axios.get("/api/students/me", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (profileRes.data) {
                setCoopStatus(profileRes.data.coop?.status || "NOT_SUBMITTED");
                setAdvisorName(profileRes.data.advisorName || "-");
            }

            // 2. Active Period
            try {
                const periodRes = await axios.get("/api/students/coop-periods/active", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (periodRes.data?.period) setActivePeriod(periodRes.data.period);
            } catch (e) { console.warn("No active coop period found"); }

            // 3. Supervision Data
            const apptRes = await axios.get("/api/coop/supervision/me", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (apptRes.data?.appointment) {
                const appt = apptRes.data.appointment;
                setAppointment(appt);
                setSupType(appt.supervisionType);
                setOnlineLink(appt.onlineLink || "");

                // โหลดวันที่ที่เคยเสนอไว้เข้า Form State
                if (appt.proposedDates) {
                    try {
                        setDates(JSON.parse(appt.proposedDates));
                    } catch (e) {
                        setDates([""]);
                    }
                }
            }
            // 4. ปฏิทินนิเทศ — วันที่จองทั้งหมดของทุกคน
            try {
                const calRes = await axios.get("/api/coop/supervision/calendar", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (calRes.data?.events) setCalendarEvents(calRes.data.events);
            } catch { /* ไม่ร้าย ถ้าดึงไม่ได้ */ }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // --- Handlers ---
    const handleAddDate = () => {
        if (dates.length >= 3) return alert("เสนอวันได้สูงสุด 3 วัน");
        setDates([...dates, ""]);
    };

    const handleRemoveDate = (index: number) => setDates(dates.filter((_, i) => i !== index));

    const handleDateChange = (index: number, value: string) => {
        const newDates = [...dates];
        newDates[index] = value;
        setDates(newDates);
    };

    const handleSubmit = async () => {
        const validDates = dates.filter(d => {
            if (!d) return false;
            const datePart = d.split('|')[0];
            return datePart && datePart.trim() !== "";
        });

        if (validDates.length === 0) return alert("กรุณาระบุวันที่ต้องการเสนออย่างน้อย 1 วัน");

        for (let i = 0; i < validDates.length; i++) {
            const timePart = validDates[i].split('|')[1];
            if (timePart) {
                const [start, end] = timePart.split('-');
                if (start >= end) {
                    return alert(`ตัวเลือกที่ ${i + 1}: เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด`);
                }
            }
        }

        if (supType === "ONLINE" && !onlineLink.trim()) {
            return alert("กรุณาระบุ Link สำหรับการนิเทศออนไลน์ (เช่น Zoom, Google Meet)");
        }

        let confirmMsg = "ยืนยันการเสนอวันนิเทศให้อาจารย์พิจารณา?";
        if (isEditing && appointment?.status === 'DATE_CONFIRMED') {
            confirmMsg = "การแก้ไขจะทำให้อาจารย์ต้องพิจารณาเวลาใหม่ทั้งหมด ยืนยันการเปลี่ยนแปลงข้อมูล?";
        }

        if (!confirm(confirmMsg)) return;

        try {
            await axios.post("/api/coop/supervision/propose", {
                proposedDates: JSON.stringify(validDates),
                supervisionType: supType,
                onlineLink: supType === "ONLINE" ? onlineLink : null,
                // ส่งชื่อ Co-Teacher เดิมไปด้วยเพื่อไม่ให้ข้อมูลหาย
                coTeacherName: appointment?.coTeacherName || null
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert("บันทึกและส่งข้อมูลการนัดหมายเรียบร้อยแล้ว");
            setIsEditing(false); // ปิดโหมดแก้ไข
            fetchData(); // โหลดข้อมูลใหม่
        } catch (err: any) {
            alert(err.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก");
        }
    };

    const isInternshipPhase = [
        "INTERNSHIP_STARTED", "T002_SUBMITTED", "T002_EDITS_REQUIRED",
        "T003_SUBMITTED", "T003_EDITS_REQUIRED", "T003_APPROVED"
    ].includes(coopStatus);

    // 🟢 ตรรกะแสดงฟอร์ม: ให้แสดงถ้ายังไม่เคยนัดหมาย, อาจารย์ตีกลับ, หรือผู้ใช้กดปุ่มแก้ไข
    const showFormView = !appointment || appointment.status === 'TEACHER_REJECTED' || isEditing;

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#0074B7' }}>กำลังโหลดข้อมูล...</div>;

    const teacherFullName = appointment?.teacher ? `${appointment.teacher.prefix || ''}${appointment.teacher.firstName} ${appointment.teacher.lastName}` : advisorName;

    return (
        <div className="page" style={{ padding: 4, margin: 28 }}>

            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>🚗 นัดหมายนิเทศสหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>เสนอวันเวลาและรูปแบบการนิเทศ เพื่อให้อาจารย์พิจารณาออกติดตามผล</div>
                </div>
                <StatusBadge status={appointment?.status || coopStatus} hidePrefix={true} />
            </div>

            {!isInternshipPhase && (
                <section className="card" style={{ background: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 15 }}>
                    <div style={{ fontSize: 32 }}>🚫</div>
                    <div>
                        <h3 style={{ margin: '0 0 5px 0', color: '#991b1b' }}>ยังไม่สามารถนัดหมายนิเทศได้</h3>
                        <div style={{ fontSize: 14, color: '#b91c1c' }}>
                            สิทธิ์การนัดหมายนิเทศจะเปิดให้ใช้งานเมื่อสถานะเข้าสู่ <b>"กำลังฝึกงาน (INTERNSHIP_STARTED)"</b> ขึ้นไปเท่านั้น<br />
                            <div style={{ marginTop: 8 }}>สถานะปัจจุบันของคุณ: <StatusBadge status={coopStatus} hidePrefix={true} /></div>
                        </div>
                    </div>
                </section>
            )}

            {isInternshipPhase && (
                <>
                    {/* ================= CARD 1: ข้อมูลช่วงเวลา (จากเจ้าหน้าที่) ================= */}
                    <section className="card" style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
                            <span style={{ fontSize: 20 }}>📌</span>
                            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>กำหนดการนิเทศสหกิจศึกษา</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                            <InfoRow label="ปีการศึกษา / เทอม" value={activePeriod ? `${activePeriod.academicYear} / ${activePeriod.semester}` : "-"} />
                            <InfoRow label="สถานะระบบนัดหมาย" value={
                                activePeriod?.isSupervisionOpen
                                    ? <span style={{ color: '#16a34a', fontWeight: 'bold' }}>🟢 เปิดให้จองคิว</span>
                                    : <span style={{ color: '#dc2626', fontWeight: 'bold' }}>🔴 ปิดระบบ</span>
                            } />
                            <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', gap: 20 }}>
                                <div>
                                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>เริ่มนิเทศตั้งแต่วันที่</div>
                                    <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{activePeriod?.supervisionStartDate ? new Date(activePeriod.supervisionStartDate).toLocaleDateString('th-TH', { dateStyle: 'long' }) : "รอประกาศ"}</div>
                                </div>
                                <div style={{ borderLeft: '1px solid #cbd5e1' }}></div>
                                <div>
                                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>ถึงวันที่</div>
                                    <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{activePeriod?.supervisionEndDate ? new Date(activePeriod.supervisionEndDate).toLocaleDateString('th-TH', { dateStyle: 'long' }) : "รอประกาศ"}</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ================= CARD 2: ฟอร์มยื่นเสนอ / สถานะ ================= */}
                    <section className="card">

                        {/* 🟢 กรณี 1: โชว์แบบฟอร์มให้กรอก / แก้ไข */}
                        {showFormView && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e0f2fe', paddingBottom: 10, marginBottom: 16 }}>
                                    <h3 style={{ margin: 0, color: '#0369a1' }}>
                                        {isEditing ? '✏️ แก้ไขวันนิเทศ' : 'ยื่นเสนอวันนิเทศ'}
                                    </h3>
                                    {isEditing && (
                                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, borderColor: '#fca5a5', color: '#dc2626' }} onClick={() => { setIsEditing(false); fetchData(); }}>
                                            ❌ ยกเลิกการแก้ไข
                                        </button>
                                    )}
                                </div>

                                {appointment?.status === 'TEACHER_REJECTED' && !isEditing && (
                                    <div style={{ background: '#fef2f2', padding: 15, borderRadius: 8, border: '1px dashed #fca5a5', color: '#be123c', marginBottom: 20, fontSize: 14 }}>
                                        <strong>⚠️ อาจารย์ไม่สะดวกในวันดังกล่าว แจ้งว่า:</strong> {appointment.rejectReason || "กรุณาเสนอวันอื่น"}
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>

                                    {/* ฝั่งซ้าย: รูปแบบและอาจารย์ */}
                                    <div>
                                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                                            <label style={lblStyle}>1. อาจารย์ที่ปรึกษา (ผู้นิเทศหลัก)</label>
                                            <input className="input" value={teacherFullName} disabled style={{ marginBottom: 12, background: '#f1f5f9', color: '#334155', fontWeight: 600 }} />

                                            <label style={lblStyle}>2. อาจารย์นิเทศร่วม</label>
                                            <input
                                                className="input"
                                                value={appointment?.coTeacherName || "รอเจ้าหน้าที่กำหนดให้ในภายหลัง"}
                                                disabled
                                                style={{ background: '#f1f5f9', color: appointment?.coTeacherName ? '#334155' : '#94a3b8', fontStyle: appointment?.coTeacherName ? 'normal' : 'italic' }}
                                            />
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>* การพิจารณาวันว่าง จะให้สิทธิ์อาจารย์ที่ปรึกษา (หลัก) เป็นผู้เลือกจากตัวเลือกที่คุณเสนอ</div>
                                        </div>

                                        <label style={{ ...lblStyle, marginTop: 16 }}>รูปแบบการนิเทศ <span style={{ color: 'red' }}>*</span></label>
                                        <div style={{ display: 'flex', gap: 15, marginTop: 8 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                                <input type="radio" name="type" checked={supType === 'ONLINE'} onChange={() => setSupType('ONLINE')} /> 🌐 ออนไลน์ (Online)
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                                <input type="radio" name="type" checked={supType === 'ONSITE'} onChange={() => setSupType('ONSITE')} /> 🏢 ออนไซต์ (ณ บริษัท)
                                            </label>
                                        </div>

                                        {supType === 'ONLINE' && (
                                            <div style={{ marginTop: 16, background: '#f0f9ff', padding: 15, borderRadius: 8, border: '1px solid #bae6fd' }}>
                                                <label style={lblStyle}>🔗 Link สำหรับเข้าร่วมประชุม (Zoom, Google Meet) <span style={{ color: 'red' }}>*</span></label>
                                                <input className="input" placeholder="https://meet.google.com/..." value={onlineLink} onChange={e => setOnlineLink(e.target.value)} />
                                            </div>
                                        )}
                                    </div>

                                    {/* ฝั่งขวา: เลือกวันแบบแยก วันที่ และ ช่วงเวลา */}
                                    <div>
                                        <label style={lblStyle}>ช่วงเวลาที่เสนอ (สูงสุด 3 ตัวเลือก) <span style={{ color: 'red' }}>*</span></label>
                                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 12 }}>แนะนำให้ปรึกษาพี่เลี้ยงก่อนกำหนดวัน เพื่อไม่ให้กระทบตารางงาน</p>

                                        {dates.map((dateStr, idx) => {
                                            const currentVal = dateStr || "|08:00-10:30";
                                            const [dPart, tPart] = currentVal.includes('|') ? currentVal.split('|') : [currentVal, '08:00-10:30'];
                                            const safeTime = tPart || "08:00-10:30";
                                            const [startTime, endTime] = safeTime.split('-');

                                            return (
                                                <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 15, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                    <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: 8, color: '#475569', fontWeight: 700, fontSize: 14 }}>ตัวเลือก {idx + 1}</div>

                                                    <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                                                        <input
                                                            type="date"
                                                            className="input"
                                                            style={{ flex: 1, minWidth: '130px' }}
                                                            value={dPart || ''}
                                                            onChange={(e) => handleDateChange(idx, `${e.target.value}|${startTime}-${endTime}`)}
                                                        />

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <select
                                                                className="input"
                                                                style={{ width: '100px', textAlign: 'center' }}
                                                                value={startTime}
                                                                onChange={(e) => handleDateChange(idx, `${dPart || ''}|${e.target.value}-${endTime}`)}
                                                            >
                                                                {timeOptions.map(t => <option key={`start-${t}`} value={t}>{t.replace(':', '.')} น.</option>)}
                                                            </select>
                                                            <span style={{ fontWeight: 'bold', color: '#64748b' }}>-</span>
                                                            <select
                                                                className="input"
                                                                style={{ width: '100px', textAlign: 'center' }}
                                                                value={endTime}
                                                                onChange={(e) => handleDateChange(idx, `${dPart || ''}|${startTime}-${e.target.value}`)}
                                                            >
                                                                {timeOptions.map(t => <option key={`end-${t}`} value={t}>{t.replace(':', '.')} น.</option>)}
                                                            </select>
                                                        </div>

                                                        {dates.length > 1 && (
                                                            <button onClick={() => handleRemoveDate(idx)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '10px 14px', borderRadius: 8, cursor: 'pointer' }}>✕</button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {dates.length < 3 && (
                                            <button className="btn-secondary" onClick={handleAddDate} style={{ width: '100%', marginTop: 5, borderStyle: 'dashed' }}>
                                                + เพิ่มตัวเลือกวันที่
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 24, paddingTop: 20, textAlign: 'right' }}>
                                    <button className="btn btn-primary" onClick={handleSubmit} disabled={!activePeriod?.isSupervisionOpen}>
                                        🚀 ส่งข้อมูลให้อาจารย์พิจารณา
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 🟡 กรณี 2: รออาจารย์ตอบ (PENDING) */}
                        {appointment?.status === 'PENDING_TEACHER' && !isEditing && (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <div style={{ fontSize: 48, marginBottom: 10 }}>⏳</div>
                                <h3 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>รออาจารย์ยืนยันวันนิเทศ</h3>

                                <div style={{ maxWidth: 500, margin: '20px auto', background: '#f8fafc', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'left' }}>
                                    <InfoRow label="อาจารย์ที่ปรึกษา" value={teacherFullName} />
                                    <InfoRow label="อาจารย์ร่วมนิเทศ" value={appointment.coTeacherName || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>รอเจ้าหน้าที่กำหนดภายหลัง</span>} />
                                    <InfoRow label="รูปแบบ" value={appointment.supervisionType === 'ONLINE' ? '🌐 ออนไลน์' : '🏢 ออนไซต์'} />
                                    {appointment.supervisionType === 'ONLINE' && (
                                        <InfoRow label="Link นิเทศ" value={appointment.onlineLink ? <a href={appointment.onlineLink} target="_blank" rel="noreferrer">{appointment.onlineLink}</a> : "-"} />
                                    )}
                                    <div style={{ marginTop: 15 }}>
                                        <div style={lblStyle}>ช่วงเวลาที่เสนอไป:</div>
                                        <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, color: '#334155' }}>
                                            {JSON.parse(appointment.proposedDates).map((d: string, i: number) => (
                                                <li key={i} style={{ marginBottom: 6 }}>{formatProposedDate(d)}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div style={{ marginTop: 20 }}>
                                    <button className="btn-secondary" onClick={() => setIsEditing(true)}>
                                        ✏️ แก้ไขเวลา หรือรูปแบบการนิเทศ
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 🟢 กรณี 3: อาจารย์เลือกแล้ว หรือ มีหนังสือแล้ว */}
                        {(appointment?.status === 'DATE_CONFIRMED' || appointment?.status === 'LETTER_UPLOADED' || appointment?.status === 'COMPLETED') && !isEditing && (
                            <div>
                                <h3 style={{ margin: '0 0 20px 0', color: '#16a34a', borderBottom: '1px solid #dcfce7', paddingBottom: 10 }}>สรุปข้อมูลการนิเทศสหกิจศึกษา</h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>

                                    {/* กล่องซ้าย: ข้อมูลที่คอนเฟิร์มแล้ว */}
                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 24, borderRadius: 12, position: 'relative' }}>

                                        {/* ปุ่มแก้ไข: โชว์เฉพาะตอนที่ยังไม่ออกเอกสาร */}
                                        {appointment.status === 'DATE_CONFIRMED' && (
                                            <button
                                                className="btn-secondary"
                                                style={{ position: 'absolute', top: 16, right: 16, fontSize: 12, padding: '6px 12px' }}
                                                onClick={() => setIsEditing(true)}
                                            >
                                                ✏️ ขอแก้ไขวันเวลา
                                            </button>
                                        )}

                                        <div style={{ fontSize: 14, color: '#166534', fontWeight: 700, marginBottom: 8 }}>✅ วันเวลาที่อาจารย์ยืนยันแล้ว</div>
                                        <div style={{ fontSize: 20, color: '#14532d', fontWeight: 800, marginBottom: 16 }}>
                                            {appointment.confirmedDate ? formatDateTime24(appointment.confirmedDate) + ' น.' : '-'}
                                        </div>

                                        <InfoRow label="อาจารย์ที่ปรึกษา" value={teacherFullName} />
                                        <InfoRow label="อาจารย์ร่วม" value={appointment.coTeacherName || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>รอเจ้าหน้าที่กำหนดภายหลัง</span>} />
                                        <InfoRow label="รูปแบบ" value={appointment.supervisionType === 'ONLINE' ? '🌐 ออนไลน์ (Online)' : '🏢 ออนไซต์ (ณ บริษัท)'} />

                                        {appointment.supervisionType === 'ONLINE' && appointment.onlineLink && (
                                            <div style={{ marginTop: 10, padding: 10, background: 'white', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                                                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>🔗 ลิงก์สำหรับเข้าร่วมนิเทศ (Online Session):</div>
                                                <a href={appointment.onlineLink} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all', fontSize: 14, color: '#2563eb', fontWeight: 600 }}>{appointment.onlineLink}</a>
                                            </div>
                                        )}
                                    </div>

                                    {/* กล่องขวา: สถานะเอกสาร */}
                                    <div style={{ background: appointment.status === 'LETTER_UPLOADED' ? '#eff6ff' : '#f8fafc', border: `1px solid ${appointment.status === 'LETTER_UPLOADED' ? '#bfdbfe' : '#e2e8f0'}`, padding: 24, borderRadius: 12 }}>
                                        <div style={{ fontSize: 14, color: '#475569', fontWeight: 700, marginBottom: 12 }}>📑 หนังสือขอความอนุเคราะห์นิเทศ</div>

                                        {appointment.status === 'DATE_CONFIRMED' ? (
                                            <div style={{ color: '#d97706', fontSize: 14, background: '#fffbeb', padding: 12, borderRadius: 8 }}>
                                                ⏳ วันเวลาถูกยืนยันแล้ว กำลังรอเจ้าหน้าที่พิจารณาออกหนังสือ...
                                            </div>
                                        ) : appointment.officialLetterPath ? (
                                            <div>
                                                <div style={{ color: '#0369a1', fontSize: 14, marginBottom: 15, background: 'white', padding: 12, borderRadius: 8 }}>
                                                    ✅ เจ้าหน้าที่อนุมัติการฝึกสหกิจและอัปโหลดหนังสือเรียบร้อยแล้ว<br />โปรดดาวน์โหลดไปมอบให้หน่วยงาน
                                                </div>
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => window.open(`/uploads/supervision/${appointment.officialLetterPath}`, '_blank')}
                                                    style={{ width: '100%', justifyContent: 'center' }}
                                                >
                                                    ⬇️ ดาวน์โหลดหนังสือนิเทศ (PDF)
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                </>
            )}

            <style>{`
                .card { background: #fff; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .input { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 14px; box-sizing: border-box; transition: 0.2s; outline: none; background: white; width: 100%; }
                .input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
                .input:disabled { background: #f1f5f9; color: #64748b; cursor: not-allowed; }
                .btn { padding: 10px 16px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: 0.2s; font-family: inherit; font-size: 14px; }
                .btn:hover:not(:disabled) { opacity: 0.9; }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-primary { background: #0074B7; color: white; }
                .btn-secondary { background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; }
                .btn-secondary:hover { background: #f1f5f9; }
            `}</style>

            {/* ปฏิทินนิเทศ — แสดงวันที่จองทั้งหมด */}
            <div style={{ marginTop: 24 }}>
                <SupervisionCalendar
                    events={calendarEvents}
                    title="📅 ปฏิทินนิเทศสหกิจ (วันที่ยืนยันแล้วทั้งหมด)"
                />
            </div>
        </div>
    );
}

// Component เสริม
const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
        <div style={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>{label}:</div>
        <div style={{ color: '#1e293b', fontWeight: 700, fontSize: 14 }}>{value}</div>
    </div>
);

const lblStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };