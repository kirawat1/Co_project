import React, { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import StatusBadge from "./StatusBadge";
import SupervisionCalendar from "./SupervisionCalendar";
import type { CalendarEvent } from "./SupervisionCalendar";
import AutoTextarea from "./AutoTextarea";

// --- Types ---
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
}

type SortKey = 'studentId' | 'company' | 'type' | 'status' | 'confirmedDate';
type SortDirection = 'asc' | 'desc';

// ============================================================
// Date helpers — ทุกที่ใช้ d/m/y (วัน/เดือน/ปีพุทธศักราช)
// ============================================================
const formatDMY = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
};

const formatDMYTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543} ${h}:${m} น.`;
};

/** แปลง proposed date string "2024-12-25|09:00-12:00" → { dmy, time, dayKey } */
const parseProposed = (dateStr: string) => {
    const [dPart = "", tPart = ""] = dateStr.includes("|") ? dateStr.split("|") : [dateStr, ""];
    const d = new Date(dPart);
    const dmy = isNaN(d.getTime()) ? dPart : formatDMY(dPart);
    const dayKey = dPart.slice(0, 10); // "2024-12-25"
    return { dmy, time: tPart ? `${tPart} น.` : "", dayKey, raw: dateStr };
};

export default function T_SupervisionReview() {
    const [supervisions, setSupervisions] = useState<SupervisionAppt[]>([]);
    const [loading, setLoading] = useState(true);
    const [coopPeriods, setCoopPeriods] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAppt, setSelectedAppt] = useState<SupervisionAppt | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("studentId");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

    const token = localStorage.getItem("coop.token");

    const fetchData = async () => {
        setLoading(true);
        try {
            const resPeriods = await fetch("/api/admin/coop-periods/all", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (resPeriods.ok) {
                const periodsData = await resPeriods.json();
                if (periodsData.ok && periodsData.periods) setCoopPeriods(periodsData.periods);
            }

            const res = await axios.get("/api/teacher/supervisions", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data?.supervisions) setSupervisions(res.data.supervisions);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ============================================================
    // วันที่ถูกจองแล้ว: dayKey → { studentName, time }
    // (เฉพาะ DATE_CONFIRMED ที่ไม่ใช่รายการปัจจุบัน)
    // ============================================================
    const bookedDayMap = useMemo(() => {
        const map = new Map<string, { name: string; time: string }>();
        supervisions.forEach((sup) => {
            if (sup.status === "DATE_CONFIRMED" && sup.confirmedDate) {
                const d = new Date(sup.confirmedDate);
                if (!isNaN(d.getTime())) {
                    const key = d.toISOString().slice(0, 10);
                    map.set(key, {
                        name: `${sup.student.firstName} ${sup.student.lastName}`,
                        time: formatDMYTime(sup.confirmedDate),
                    });
                }
            }
        });
        return map;
    }, [supervisions]);

    // ============================================================
    // Sorting / Filtering
    // ============================================================
    const handleSort = (key: SortKey) => {
        setSortDirection(sortKey === key && sortDirection === "asc" ? "desc" : "asc");
        setSortKey(key);
    };

    const processedSupervisions = useMemo(() => {
        let filtered = supervisions.filter((s) => {
            const matchSearch = `${s.student.studentId} ${s.student.firstName} ${s.student.lastName} ${s.student.coop?.company?.name || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
            const pId = String(s.coopPeriodId || s.student.coopPeriodId || s.student.coop?.coopPeriodId || "");
            const matchPeriod = selectedPeriod === "all" || pId === selectedPeriod;
            return matchSearch && matchPeriod;
        });

        filtered.sort((a, b) => {
            let valA = "", valB = "";
            switch (sortKey) {
                case "studentId": valA = a.student.studentId || ""; valB = b.student.studentId || ""; break;
                case "company": valA = a.student.coop?.company?.name || ""; valB = b.student.coop?.company?.name || ""; break;
                case "type": valA = a.supervisionType; valB = b.supervisionType; break;
                case "status": valA = a.status; valB = b.status; break;
                case "confirmedDate": valA = a.confirmedDate || ""; valB = b.confirmedDate || ""; break;
            }
            if (valA < valB) return sortDirection === "asc" ? -1 : 1;
            if (valA > valB) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [supervisions, selectedPeriod, searchTerm, sortKey, sortDirection]);

    // ============================================================
    // Action Handlers
    // ============================================================
    const openReviewModal = (appt: SupervisionAppt) => {
        setSelectedAppt(appt);
        setRejectReason(appt.rejectReason || "");
    };
    const closeModal = () => { setSelectedAppt(null); setRejectReason(""); };

    const handleAction = async (action: "APPROVE" | "REJECT", confirmedDateStr?: string) => {
        if (action === "REJECT" && !rejectReason.trim()) {
            return alert("กรุณาระบุเหตุผล เพื่อให้นักศึกษาทราบและเลือกวันใหม่");
        }

        const confirmMsg =
            action === "APPROVE"
                ? `ยืนยันการเลือกวันนี้?\n\n${confirmedDateStr ? parseProposed(confirmedDateStr).dmy + " เวลา " + parseProposed(confirmedDateStr).time : ""}`
                : "ยืนยันการปฏิเสธและให้นักศึกษาเสนอวันใหม่?";
        if (!confirm(confirmMsg)) return;

        setIsSubmitting(true);
        try {
            let finalConfirmedDate: string | null = null;
            if (action === "APPROVE" && confirmedDateStr) {
                const [dPart, tPart] = confirmedDateStr.split("|");
                const startTime = (tPart || "00:00").split("-")[0];
                finalConfirmedDate = `${dPart}T${startTime}:00`;
            }

            await axios.put(
                `/api/teacher/supervisions/${selectedAppt?.id}/review`,
                { action, confirmedDate: finalConfirmedDate, rejectReason: action === "REJECT" ? rejectReason : null },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert("บันทึกผลการพิจารณาเรียบร้อยแล้ว");
            closeModal();
            fetchData();
        } catch (err: any) {
            const msg = err?.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก";
            alert(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleComplete = async (id: number) => {
        if (!confirm("ยืนยันว่าการนิเทศเสร็จสิ้นแล้ว?")) return;
        try {
            await axios.put(`/api/teacher/supervisions/${id}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
            alert("บันทึกผลนิเทศเสร็จสิ้นสำเร็จ");
            fetchData();
        } catch (err: any) {
            alert(err?.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก");
        }
    };

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <span style={{ color: "#cbd5e1", marginLeft: 4 }}>↕</span>;
        return <span style={{ color: "#2563eb", marginLeft: 4 }}>{sortDirection === "asc" ? "↑" : "↓"}</span>;
    };

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
                onlineLink: s.onlineLink,
            })),
        [supervisions]
    );

    if (loading) return <div style={{ padding: 40, textAlign: "center" }}>กำลังโหลดข้อมูล...</div>;

    // ============================================================
    // Render
    // ============================================================
    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER */}
            <section style={{ ...card, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 15 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1e293b" }}>👨‍🏫 พิจารณาวันนิเทศสหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
                        ตรวจสอบและเลือกวันนิเทศ (เฉพาะอาจารย์ที่ปรึกษาหลักจะเป็นผู้มีสิทธิ์เลือกเวลา)
                    </div>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <input className="input" placeholder="🔍 ค้นหารหัส / ชื่อ / บริษัท..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: 250 }} />
                    <select className="input" style={{ width: "auto", background: "#f8fafc", padding: "10px 14px" }} value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                        <option value="all">📚 ทุกปีการศึกษา</option>
                        {coopPeriods.map((p) => <option key={p.id} value={p.id}>เทอม {p.semester} / {p.academicYear}</option>)}
                    </select>
                    <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={fetchData} disabled={loading}>{loading ? "⏳" : "🔄"} รีเฟรช</button>
                    <div style={{ background: "#ecfdf5", color: "#047857", padding: "10px 16px", borderRadius: 8, fontWeight: 700, border: "1px solid #a7f3d0" }}>
                        ทั้งหมด: {processedSupervisions.length} รายการ
                    </div>
                </div>
            </section>

            {/* วันที่ถูกจองแล้ว — summary */}
            {bookedDayMap.size > 0 && (
                <section style={{ ...card, marginBottom: 16, background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#92400e", marginBottom: 8 }}>📅 วันที่ถูกยืนยันแล้ว (ห้ามเลือกซ้ำ)</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {Array.from(bookedDayMap.entries()).map(([day, info]) => (
                            <div key={day} style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "6px 12px", fontSize: 13 }}>
                                <span style={{ fontWeight: 700 }}>{formatDMY(day)}</span>
                                <span style={{ color: "#78350f", marginLeft: 6 }}>— {info.name} ({info.time})</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ปฏิทินนิเทศ */}
            <section style={{ marginBottom: 24 }}>
                <SupervisionCalendar events={calendarEvents} title="📅 ปฏิทินนิเทศของคุณ (วันที่ยืนยันแล้ว)" />
            </section>

            {/* TABLE */}
            <section style={card}>
                <div style={{ overflowX: "auto" }}>
                    <table style={tableStyle} className="responsive-table">
                        <thead>
                            <tr style={thRow}>
                                <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort("studentId")}>รหัสนักศึกษา / ชื่อ <SortIcon columnKey="studentId" /></th>
                                <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort("company")}>หน่วยงาน <SortIcon columnKey="company" /></th>
                                <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort("type")}>รูปแบบ <SortIcon columnKey="type" /></th>
                                <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort("confirmedDate")}>วันนิเทศ (d/m/y) <SortIcon columnKey="confirmedDate" /></th>
                                <th style={th}>สิทธิ์ของคุณ</th>
                                <th style={{ ...th, cursor: "pointer" }} onClick={() => handleSort("status")}>สถานะ <SortIcon columnKey="status" /></th>
                                <th style={{ ...th, textAlign: "right" }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedSupervisions.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีรายการนิเทศที่ตรงกับเงื่อนไข</td></tr>
                            ) : processedSupervisions.map((sup) => {
                                const isPrimary = sup.isPrimaryAdvisor !== false;
                                return (
                                    <tr key={sup.id} style={trStyle}>
                                        <td style={td} data-label="รหัส / ชื่อ">
                                            <div style={{ fontWeight: 700, color: "#0f172a" }}>{sup.student.studentId}</div>
                                            <div style={{ fontSize: 13, color: "#64748b" }}>{sup.student.firstName} {sup.student.lastName}</div>
                                        </td>
                                        <td style={td} data-label="หน่วยงาน"><div style={{ fontWeight: 600 }}>{sup.student.coop?.company?.name || "-"}</div></td>
                                        <td style={td} data-label="รูปแบบ">
                                            <span style={{ fontWeight: 700, color: sup.supervisionType === "ONLINE" ? "#2563eb" : "#ea580c" }}>
                                                {sup.supervisionType === "ONLINE" ? "🌐 ออนไลน์" : "🏢 ออนไซต์"}
                                            </span>
                                        </td>
                                        {/* วันนิเทศ */}
                                        <td style={td} data-label="วันนิเทศ">
                                            {sup.confirmedDate ? (
                                                <div style={{ fontWeight: 700, color: "#16a34a" }}>✅ {formatDMYTime(sup.confirmedDate)}</div>
                                            ) : sup.proposedDates ? (
                                                <>
                                                    <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700, marginBottom: 4 }}>⏳ วันที่เสนอ</div>
                                                    {(() => {
                                                        let dates: string[] = [];
                                                        try { dates = JSON.parse(sup.proposedDates); } catch { dates = []; }
                                                        return dates.map((d, i) => {
                                                            const p = parseProposed(d);
                                                            return (
                                                                <div key={i} style={{ fontSize: 12, color: "#78350f", background: "#fef3c7", padding: "2px 6px", borderRadius: 4, marginBottom: 2 }}>
                                                                    {p.dmy}{p.time ? ` · ${p.time}` : ""}
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </>
                                            ) : (
                                                <span style={{ color: "#94a3b8", fontSize: 13 }}>ยังไม่เสนอวัน</span>
                                            )}
                                        </td>
                                        <td style={td} data-label="สิทธิ์ของคุณ">
                                            <span style={{ background: isPrimary ? "#eff6ff" : "#f8fafc", color: isPrimary ? "#2563eb" : "#64748b", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: "bold", border: `1px solid ${isPrimary ? "#bfdbfe" : "#e2e8f0"}` }}>
                                                {isPrimary ? "👑 ที่ปรึกษาหลัก" : "🤝 อาจารย์ร่วม"}
                                            </span>
                                        </td>
                                        <td style={td} data-label="สถานะ"><StatusBadge status={sup.status} /></td>
                                        <td style={{ ...td, textAlign: "right" }}>
                                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                                {sup.status === "LETTER_UPLOADED" && isPrimary && (
                                                    <button className="btn" style={{ background: "#7c3aed", padding: "8px 16px" }} onClick={() => handleComplete(sup.id)}>
                                                        🏁 จบนิเทศ
                                                    </button>
                                                )}
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

            {/* MODAL */}
            {selectedAppt && (
                <div className="modal-backdrop">
                    <div className="modal-card-split" style={{ maxWidth: 1000 }}>

                        <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>
                                    {selectedAppt.isPrimaryAdvisor === false ? "ดูรายละเอียด: " : "พิจารณาวันนิเทศ: "}
                                    {selectedAppt.student.firstName} {selectedAppt.student.lastName}
                                </h3>
                                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>รหัส: {selectedAppt.student.studentId} | <StatusBadge status={selectedAppt.status} /></div>
                            </div>
                            <button onClick={closeModal} style={{ border: "none", background: "#fee2e2", color: "#dc2626", width: 32, height: 32, borderRadius: "50%", fontSize: 18, cursor: "pointer" }}>&times;</button>
                        </div>

                        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                            {/* LEFT — ข้อมูลบริษัท */}
                            <div style={{ flex: 1, padding: 24, background: "#f8fafc", borderRight: "1px solid #e2e8f0", overflowY: "auto" }}>
                                <h4 style={{ margin: "0 0 16px 0", color: "#0f172a", fontSize: 16 }}>📌 ข้อมูลการนิเทศ</h4>
                                <div style={{ background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20 }}>
                                    <InfoRow label="รูปแบบ" value={<span style={{ color: selectedAppt.supervisionType === "ONLINE" ? "#2563eb" : "#ea580c" }}>{selectedAppt.supervisionType === "ONLINE" ? "🌐 ออนไลน์" : "🏢 ออนไซต์"}</span>} />
                                    {selectedAppt.supervisionType === "ONLINE" && (
                                        <InfoRow label="Link" value={selectedAppt.onlineLink ? <a href={selectedAppt.onlineLink} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>{selectedAppt.onlineLink}</a> : "-"} />
                                    )}
                                    {selectedAppt.confirmedDate && (
                                        <InfoRow label="วันนิเทศ" value={<span style={{ color: "#16a34a", fontWeight: 700 }}>{formatDMYTime(selectedAppt.confirmedDate)}</span>} />
                                    )}
                                </div>
                                <div style={{ background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20 }}>
                                    <div style={{ fontWeight: 800, marginBottom: 12 }}>🏢 สถานที่ฝึกงาน</div>
                                    <div style={{ fontSize: 14, lineHeight: 1.8, color: "#475569" }}>
                                        <b>บริษัท:</b> {selectedAppt.student.coop?.company?.name || "-"}<br />
                                        <b>ติดต่อ:</b> {selectedAppt.student.coop?.company?.contactPerson || "-"} (โทร: {selectedAppt.student.coop?.company?.phone || "-"})<br />
                                        <b>ที่อยู่:</b> {selectedAppt.student.coop?.company?.address || "-"}
                                    </div>
                                </div>

                                {/* วันที่ถูกจองแล้วใน modal */}
                                {bookedDayMap.size > 0 && (
                                    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 14 }}>
                                        <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8, fontSize: 13 }}>⚠️ วันที่ยืนยันไปแล้ว (ห้ามเลือกซ้ำ)</div>
                                        {Array.from(bookedDayMap.entries()).map(([day, info]) => (
                                            <div key={day} style={{ fontSize: 13, color: "#78350f", marginBottom: 4 }}>
                                                • <b>{formatDMY(day)}</b> — {info.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* RIGHT — พิจารณาวัน */}
                            <div style={{ flex: 1, padding: 24, background: "#fff", overflowY: "auto", display: "flex", flexDirection: "column" }}>

                                {/* กรณี 1: รอพิจารณา + เป็นอาจารย์หลัก */}
                                {selectedAppt.status === "PENDING_TEACHER" && selectedAppt.isPrimaryAdvisor !== false && (
                                    <>
                                        <h4 style={{ margin: "0 0 10px 0", color: "#0f172a", fontSize: 16 }}>✅ เลือกวันที่นักศึกษาเสนอ</h4>
                                        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px 0" }}>กรุณากดเลือกวันและเวลาที่อาจารย์สะดวก — วันที่มีสัญลักษณ์ 🔒 ถูกจองไปแล้ว</p>

                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            {(() => {
                                                let dates: string[] = [];
                                                try { dates = JSON.parse(selectedAppt.proposedDates || "[]"); } catch { dates = []; }
                                                return dates.map((dateStr, idx) => {
                                                    const parsed = parseProposed(dateStr);
                                                    const isBooked = bookedDayMap.has(parsed.dayKey) &&
                                                        bookedDayMap.get(parsed.dayKey)?.name !== `${selectedAppt.student.firstName} ${selectedAppt.student.lastName}`;
                                                    const bookedBy = isBooked ? bookedDayMap.get(parsed.dayKey) : null;

                                                    return (
                                                        <div key={idx} style={{
                                                            padding: 16,
                                                            background: isBooked ? "#fef2f2" : "#f0fdf4",
                                                            border: `1px solid ${isBooked ? "#fca5a5" : "#bbf7d0"}`,
                                                            borderRadius: 12,
                                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                                        }}>
                                                            <div>
                                                                <div style={{ fontWeight: 800, color: isBooked ? "#991b1b" : "#166534", fontSize: 15 }}>
                                                                    {isBooked ? "🔒 " : ""}{parsed.dmy}
                                                                </div>
                                                                <div style={{ color: isBooked ? "#b91c1c" : "#15803d", fontSize: 14, marginTop: 4 }}>{parsed.time}</div>
                                                                {isBooked && bookedBy && (
                                                                    <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                                                                        จองโดย: {bookedBy.name} ({bookedBy.time})
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <button
                                                                className={isBooked ? "btn" : "btn-success"}
                                                                style={{ background: isBooked ? "#9ca3af" : undefined, padding: "10px 16px", cursor: isBooked ? "not-allowed" : "pointer" }}
                                                                onClick={() => !isBooked && handleAction("APPROVE", dateStr)}
                                                                disabled={isSubmitting || isBooked}
                                                                title={isBooked ? "วันนี้ถูกจองแล้ว กรุณาเลือกวันอื่น" : "เลือกวันนี้"}
                                                            >
                                                                {isBooked ? "ถูกจองแล้ว" : "เลือกวันนี้"}
                                                            </button>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>

                                        <div style={{ margin: "24px 0", borderTop: "1px dashed #cbd5e1" }} />
                                        <h4 style={{ margin: "0 0 10px 0", color: "#991b1b", fontSize: 16 }}>⚠️ กรณีไม่สะดวกทุกวัน</h4>
                                        <label style={{ fontSize: 13, color: "#475569", marginBottom: 8, display: "block" }}>ระบุเหตุผลหรือวันที่สะดวก เพื่อให้นักศึกษาเสนอใหม่</label>
                                        <AutoTextarea className="input" rows={3} placeholder="เช่น ขอเลื่อนเป็นสัปดาห์หน้า..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                                        <button className="btn-danger" style={{ width: "100%", marginTop: 12 }} onClick={() => handleAction("REJECT")} disabled={isSubmitting}>
                                            ปฏิเสธให้เลือกวันใหม่
                                        </button>
                                    </>
                                )}

                                {/* กรณี 2: อาจารย์ร่วม — ดูอย่างเดียว */}
                                {selectedAppt.status === "PENDING_TEACHER" && selectedAppt.isPrimaryAdvisor === false && (
                                    <div style={{ textAlign: "center", marginTop: "10%" }}>
                                        <div style={{ fontSize: 48, marginBottom: 10 }}>👀</div>
                                        <h3 style={{ margin: "0 0 10px 0", color: "#0f172a" }}>รออาจารย์ที่ปรึกษาหลักยืนยัน</h3>
                                        <div style={{ marginTop: 24, textAlign: "left", background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                                            <div style={{ fontWeight: 700, color: "#334155", marginBottom: 8 }}>วันที่นักศึกษาเสนอ:</div>
                                            {(() => {
                                                let dates: string[] = [];
                                                try { dates = JSON.parse(selectedAppt.proposedDates || "[]"); } catch { dates = []; }
                                                return <ul style={{ margin: 0, paddingLeft: 20, color: "#475569", fontSize: 14 }}>
                                                    {dates.map((d, i) => { const p = parseProposed(d); return <li key={i} style={{ marginBottom: 6 }}>{p.dmy} {p.time}</li>; })}
                                                </ul>;
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* กรณี 3: พิจารณาแล้ว */}
                                {selectedAppt.status !== "PENDING_TEACHER" && (
                                    <div style={{ textAlign: "center", marginTop: "15%" }}>
                                        {selectedAppt.status === "TEACHER_REJECTED" ? (
                                            <div style={{ color: "#dc2626", fontSize: 16, fontWeight: "bold" }}>
                                                <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
                                                แจ้งให้นักศึกษาเลือกวันใหม่แล้ว<br />
                                                <span style={{ fontSize: 13, color: "#64748b", fontWeight: "normal", display: "block", marginTop: 8 }}>เหตุผล: {selectedAppt.rejectReason || "-"}</span>
                                            </div>
                                        ) : (
                                            <div style={{ color: "#16a34a", fontSize: 16, fontWeight: "bold" }}>
                                                <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                                                ยืนยันวันนิเทศเรียบร้อย<br />
                                                <span style={{ fontSize: 14, color: "#475569", fontWeight: "normal", display: "block", marginTop: 10 }}>
                                                    วันที่: {formatDMYTime(selectedAppt.confirmedDate)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .input { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box; resize: vertical; }
                .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
                .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .6); display: flex; align-items: center; justify-content: center; z-index: 999; backdrop-filter: blur(4px); }
                .modal-card-split { background: #fff; border-radius: 16px; width: 95vw; height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
            `}</style>
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
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thRow: CSSProperties = { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" };
const th: CSSProperties = { padding: "14px 16px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#64748b", userSelect: "none" };
const trStyle: CSSProperties = { borderBottom: "1px solid #f1f5f9" };
const td: CSSProperties = { padding: "14px 16px", verticalAlign: "middle", fontSize: 14 };
