import React, { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import axios from "axios";
import StatusBadge from "./StatusBadge";

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
    isPrimaryAdvisor?: boolean; // 🟢 Backend ต้องส่งมาให้
    coopPeriodId?: number; // เผื่อติดมากับตัว supervision
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

// 🟢 Types สำหรับการเรียงลำดับ (Sorting)
type SortKey = 'studentId' | 'company' | 'type' | 'status';
type SortDirection = 'asc' | 'desc';

export default function T_SupervisionReview() {
    const [supervisions, setSupervisions] = useState<SupervisionAppt[]>([]);
    const [loading, setLoading] = useState(true);

    // ✅ State สำหรับค้นหาและตัวกรองปีการศึกษา
    const [coopPeriods, setCoopPeriods] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [selectedAppt, setSelectedAppt] = useState<SupervisionAppt | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 🟢 State สำหรับการเรียงลำดับ (Sorting)
    const [sortKey, setSortKey] = useState<SortKey>('studentId');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const token = localStorage.getItem("coop.token");

    const fetchData = async () => {
        setLoading(true);
        try {
            // 🟢 ดึงรอบปีการศึกษามาแสดงใน Dropdown
            const resPeriods = await fetch("http://localhost:5000/api/admin/coop-periods/all", { headers: { Authorization: `Bearer ${token}` } });
            if (resPeriods.ok) {
                const periodsData = await resPeriods.json();
                if (periodsData.ok && periodsData.periods) setCoopPeriods(periodsData.periods);
            }

            // 🟢 ดึงข้อมูลรายการนิเทศ "เฉพาะของอาจารย์ที่ล็อกอิน"
            const res = await axios.get("http://localhost:5000/api/teacher/supervisions", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.supervisions) {
                setSupervisions(res.data.supervisions);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // --- Format Helpers ---
    const formatDateTime24 = (dateString: string) => {
        return new Date(dateString).toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    };

    const formatProposedDate = (dateStr: string) => {
        if (!dateStr) return { date: "-", time: "-" };
        const [dPart, tPart] = dateStr.includes('|') ? dateStr.split('|') : [dateStr, ""];
        const formattedDate = new Date(dPart).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
        return { date: formattedDate, time: tPart ? `${tPart} น.` : '' };
    };

    // 🟢 ฟังก์ชันสำหรับจัดการการคลิก Header เพื่อเรียงลำดับ
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    // ✅ กรองรายชื่อ (ค้นหา + ปีการศึกษา) และ เรียงลำดับ (Sort)
    const processedSupervisions = useMemo(() => {
        // 1. Filter
        let filtered = supervisions.filter(s => {
            const matchSearch = `${s.student.studentId} ${s.student.firstName} ${s.student.lastName} ${s.student.coop?.company?.name || ""}`.toLowerCase().includes(searchTerm.toLowerCase());

            // ดักจับ id ของปีการศึกษา จาก object ที่ซ้อนกัน
            const pId = String(s.coopPeriodId || s.student.coopPeriodId || s.student.coop?.coopPeriodId || "");
            const matchPeriod = selectedPeriod === "all" || pId === selectedPeriod;

            return matchSearch && matchPeriod;
        });

        // 2. Sort
        filtered.sort((a, b) => {
            let valA = '';
            let valB = '';

            switch (sortKey) {
                case 'studentId': valA = a.student.studentId || ''; valB = b.student.studentId || ''; break;
                case 'company': valA = a.student.coop?.company?.name || ''; valB = b.student.coop?.company?.name || ''; break;
                case 'type': valA = a.supervisionType; valB = b.supervisionType; break;
                case 'status': valA = a.status; valB = b.status; break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [supervisions, selectedPeriod, searchTerm, sortKey, sortDirection]);


    // --- Action Handlers ---
    const openReviewModal = (appt: SupervisionAppt) => {
        setSelectedAppt(appt);
        setRejectReason(appt.rejectReason || "");
    };

    const closeModal = () => {
        setSelectedAppt(null);
        setRejectReason("");
    };

    const handleAction = async (action: 'APPROVE' | 'REJECT', confirmedDateStr?: string) => {
        if (action === 'REJECT' && !rejectReason.trim()) {
            return alert("กรุณาระบุเหตุผล เพื่อให้นักศึกษาทราบและเลือกวันใหม่");
        }

        let confirmMsg = action === 'APPROVE'
            ? `ยืนยันการเลือกเวลานี้ใช่หรือไม่?\n\n(${formatProposedDate(confirmedDateStr || "").date} เวลา ${formatProposedDate(confirmedDateStr || "").time})`
            : "ยืนยันการปฏิเสธและให้นักศึกษาเสนอวันใหม่?";

        if (!confirm(confirmMsg)) return;

        setIsSubmitting(true);
        try {
            let finalConfirmedDate = null;
            if (action === 'APPROVE' && confirmedDateStr) {
                const [dPart, tPart] = confirmedDateStr.split('|');
                const startTime = tPart.split('-')[0];
                finalConfirmedDate = `${dPart}T${startTime}:00`;
            }

            await axios.put(`http://localhost:5000/api/teacher/supervisions/${selectedAppt?.id}/review`, {
                action,
                confirmedDate: finalConfirmedDate,
                rejectReason: action === 'REJECT' ? rejectReason : null
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert("บันทึกผลการพิจารณาเรียบร้อยแล้ว");
            closeModal();
            fetchData();
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSubmitting(false);
        }
    };

    // UI HELPER: แสดงลูกศรเรียงลำดับ
    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <span style={{ color: '#cbd5e1', marginLeft: 4 }}>↕</span>;
        return <span style={{ color: '#2563eb', marginLeft: 4 }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูล...</div>;

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 15 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>👨‍🏫 พิจารณาวันนิเทศสหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
                        ตรวจสอบและเลือกวันนิเทศ (เฉพาะอาจารย์ที่ปรึกษาหลักจะเป็นผู้มีสิทธิ์เลือกเวลา)
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        className="input"
                        placeholder="🔍 ค้นหารหัส / ชื่อ / บริษัท..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                    />

                    <select className="input" style={{ width: 'auto', background: '#f8fafc', padding: '10px 14px' }} value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
                        <option value="all">📚 ทุกปีการศึกษา</option>
                        {coopPeriods.map(p => (
                            <option key={p.id} value={p.id}>เทอม {p.semester} / {p.academicYear}</option>
                        ))}
                    </select>

                    <button className="btn-ghost" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={fetchData} disabled={loading}>
                        {loading ? '⏳' : '🔄'} รีเฟรช
                    </button>

                    <div style={{ background: '#ecfdf5', color: '#047857', padding: '10px 16px', borderRadius: 8, fontWeight: 700, border: '1px solid #a7f3d0' }}>
                        ทั้งหมด: {processedSupervisions.length} รายการ
                    </div>
                </div>
            </section>

            <section style={card}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={thRow}>
                                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('studentId')}>
                                    รหัสนักศึกษา / ชื่อ-สกุล <SortIcon columnKey="studentId" />
                                </th>
                                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('company')}>
                                    หน่วยงานที่ฝึก <SortIcon columnKey="company" />
                                </th>
                                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('type')}>
                                    รูปแบบนิเทศ <SortIcon columnKey="type" />
                                </th>
                                <th style={th}>สิทธิ์ของคุณ</th>
                                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>
                                    สถานะ <SortIcon columnKey="status" />
                                </th>
                                <th style={{ ...th, textAlign: 'right' }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedSupervisions.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>ไม่มีรายการนิเทศที่ตรงกับเงื่อนไข</td></tr>
                            ) : processedSupervisions.map(sup => {
                                // 🟢 กำหนดสถานะปุ่มตามสิทธิ์ (เป็นอาจารย์หลักไหม?)
                                const isPrimary = sup.isPrimaryAdvisor !== false;

                                return (
                                    <tr key={sup.id} style={trStyle}>
                                        <td style={td}>
                                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{sup.student.studentId}</div>
                                            <div style={{ fontSize: 13, color: '#64748b' }}>{sup.student.firstName} {sup.student.lastName}</div>
                                        </td>
                                        <td style={td}>
                                            <div style={{ fontWeight: 600 }}>{sup.student.coop?.company?.name || "-"}</div>
                                        </td>
                                        <td style={td}>
                                            <div style={{ fontWeight: 700, color: sup.supervisionType === 'ONLINE' ? '#2563eb' : '#ea580c' }}>
                                                {sup.supervisionType === 'ONLINE' ? '🌐 ออนไลน์' : '🏢 ออนไซต์'}
                                            </div>
                                        </td>
                                        <td style={td}>
                                            <span style={{
                                                background: isPrimary ? '#eff6ff' : '#f8fafc',
                                                color: isPrimary ? '#2563eb' : '#64748b',
                                                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 'bold', border: `1px solid ${isPrimary ? '#bfdbfe' : '#e2e8f0'}`
                                            }}>
                                                {isPrimary ? '👑 ที่ปรึกษาหลัก' : '🤝 อาจารย์ร่วม'}
                                            </span>
                                        </td>
                                        <td style={td}>
                                            <StatusBadge status={sup.status} />
                                        </td>
                                        <td style={{ ...td, textAlign: 'right' }}>
                                            <button
                                                className="btn"
                                                style={{ background: (sup.status === 'PENDING_TEACHER' && isPrimary) ? '#10b981' : '#0ea5e9', padding: '8px 16px' }}
                                                onClick={() => openReviewModal(sup)}
                                            >
                                                {(sup.status === 'PENDING_TEACHER' && isPrimary) ? "พิจารณาวันนิเทศ" : "🔍 ดูรายละเอียด"}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* MODAL: SPLIT SCREEN */}
            {selectedAppt && (
                <div className="modal-backdrop">
                    <div className="modal-card-split" style={{ maxWidth: 1000 }}>

                        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, color: '#1e293b' }}>
                                    {selectedAppt.isPrimaryAdvisor === false ? 'ดูรายละเอียดการนิเทศ: ' : 'พิจารณาวันนิเทศ: '}
                                    {selectedAppt.student.firstName} {selectedAppt.student.lastName}
                                </h3>
                                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>รหัส: {selectedAppt.student.studentId} | <StatusBadge status={selectedAppt.status} /></div>
                            </div>
                            <button onClick={closeModal} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                            {/* LEFT: ข้อมูลบริษัท & รูปแบบ (50%) */}
                            <div style={{ flex: '1', padding: 24, background: '#f8fafc', borderRight: '1px solid #e2e8f0', overflowY: 'auto' }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: 16 }}>📌 ข้อมูลการนิเทศ</h4>

                                <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                                    <InfoRow label="รูปแบบ" value={
                                        <span style={{ color: selectedAppt.supervisionType === 'ONLINE' ? '#2563eb' : '#ea580c' }}>
                                            {selectedAppt.supervisionType === 'ONLINE' ? '🌐 ออนไลน์ (Online)' : '🏢 ออนไซต์ (ไปสถานประกอบการ)'}
                                        </span>
                                    } />
                                    {selectedAppt.supervisionType === 'ONLINE' && (
                                        <InfoRow label="Link ประชุม" value={
                                            selectedAppt.onlineLink ? <a href={selectedAppt.onlineLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{selectedAppt.onlineLink}</a> : "-"
                                        } />
                                    )}
                                </div>

                                <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontWeight: 800, marginBottom: 12, color: '#334155' }}>🏢 ข้อมูลสถานที่ฝึกงาน</div>
                                    <div style={{ fontSize: 14, lineHeight: 1.6, color: '#475569' }}>
                                        <b>บริษัท:</b> {selectedAppt.student.coop?.company?.name || "-"}<br />
                                        <b>ติดต่อ:</b> {selectedAppt.student.coop?.company?.contactPerson || "-"} (โทร: {selectedAppt.student.coop?.company?.phone || "-"})<br />
                                        <b>ที่อยู่:</b> {selectedAppt.student.coop?.company?.address || "-"}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: เลือกวันเวลา & พิจารณา (50%) */}
                            <div style={{ flex: '1', padding: 24, background: '#fff', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                                {/* 🟡 กรณี 1: รอการพิจารณา และ เป็นอาจารย์หลัก */}
                                {selectedAppt.status === 'PENDING_TEACHER' && selectedAppt.isPrimaryAdvisor !== false && (
                                    <>
                                        <h4 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: 16 }}>✅ ตัวเลือกวันที่นักศึกษาเสนอ</h4>
                                        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px 0' }}>กรุณากดเลือกวันและเวลาที่อาจารย์สะดวกที่สุด 1 รายการ</p>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {JSON.parse(selectedAppt.proposedDates || "[]").map((dateStr: string, idx: number) => {
                                                const formatted = formatProposedDate(dateStr);
                                                return (
                                                    <div key={idx} style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 800, color: '#166534', fontSize: 15 }}>{formatted.date}</div>
                                                            <div style={{ color: '#15803d', fontSize: 14, marginTop: 4 }}>{formatted.time}</div>
                                                        </div>
                                                        <button className="btn" style={{ background: '#16a34a', padding: '10px 16px' }} onClick={() => handleAction('APPROVE', dateStr)} disabled={isSubmitting}>
                                                            เลือกเวลานี้
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div style={{ margin: '30px 0', borderTop: '1px dashed #cbd5e1' }}></div>
                                        <h4 style={{ margin: '0 0 10px 0', color: '#991b1b', fontSize: 16 }}>⚠️ กรณีไม่สะดวกในวันดังกล่าว</h4>
                                        <label style={{ fontSize: 13, color: '#475569', marginBottom: 8, display: 'block' }}>ระบุเหตุผล หรือ วันที่อาจารย์สะดวก เพื่อให้นักศึกษาเสนอใหม่</label>
                                        <textarea className="input" rows={3} placeholder="เช่น ขอเลื่อนเป็นสัปดาห์หน้า..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                                        <button className="btn" style={{ background: '#dc2626', width: '100%', marginTop: 12 }} onClick={() => handleAction('REJECT')} disabled={isSubmitting}>
                                            ปฏิเสธให้เลือกวันใหม่
                                        </button>
                                    </>
                                )}

                                {/* 🟡 กรณี 2: รอการพิจารณา แต่ เป็นอาจารย์นิเทศร่วม (ดูได้อย่างเดียว) */}
                                {selectedAppt.status === 'PENDING_TEACHER' && selectedAppt.isPrimaryAdvisor === false && (
                                    <div style={{ textAlign: 'center', marginTop: '10%' }}>
                                        <div style={{ fontSize: 48, marginBottom: 10 }}>👀</div>
                                        <h3 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>รออาจารย์ที่ปรึกษาหลักยืนยัน</h3>
                                        <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
                                            คุณเป็น <b>"อาจารย์นิเทศร่วม"</b> ของนักศึกษาคนนี้<br />
                                            สิทธิ์ในการเลือกวัน-เวลา จะเป็นหน้าที่ของอาจารย์ที่ปรึกษาหลัก
                                        </p>

                                        <div style={{ marginTop: 24, textAlign: 'left', background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontWeight: 700, color: '#334155', marginBottom: 8 }}>📌 ช่วงเวลาที่นักศึกษาเสนอมา:</div>
                                            <ul style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 14 }}>
                                                {JSON.parse(selectedAppt.proposedDates || "[]").map((d: string, i: number) => {
                                                    const fmt = formatProposedDate(d);
                                                    return <li key={i} style={{ marginBottom: 6 }}>{fmt.date} {fmt.time}</li>
                                                })}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {/* 🟡 กรณี 3: อาจารย์พิจารณาแล้ว (ยืนยันแล้ว หรือ ปฏิเสธ) -> แสดงเหมือนกันทั้งสองฝ่าย */}
                                {selectedAppt.status !== 'PENDING_TEACHER' && (
                                    <div style={{ textAlign: 'center', marginTop: '15%' }}>
                                        {selectedAppt.status === 'TEACHER_REJECTED' ? (
                                            <div style={{ color: '#dc2626', fontSize: 16, fontWeight: 'bold' }}>
                                                <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
                                                อาจารย์หลักแจ้งให้นักศึกษาเลือกวันใหม่แล้ว<br />(กำลังรอนักศึกษาเสนอมาอีกครั้ง)
                                            </div>
                                        ) : (
                                            <div style={{ color: '#16a34a', fontSize: 16, fontWeight: 'bold' }}>
                                                <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                                                ยืนยันวันนิเทศเรียบร้อยแล้ว<br />
                                                <span style={{ fontSize: 14, color: '#475569', fontWeight: 'normal', display: 'block', marginTop: 10 }}>
                                                    วันที่สรุป: {selectedAppt.confirmedDate ? formatDateTime24(selectedAppt.confirmedDate) + ' น.' : '-'}
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
                .btn { border-radius: 8px; border: none; font-weight: 700; color: white; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; }
                .btn:hover:not(:disabled) { opacity: 0.8; }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-ghost { padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; background: #fff; cursor: pointer; transition: 0.2s; }
                .btn-ghost:hover { background: #f1f5f9; }
                .input { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box; resize: vertical; }
                .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
                .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .6); display: flex; align-items: center; justify-content: center; z-index: 999; backdrop-filter: blur(4px); }
                .modal-card-split { background: #fff; border-radius: 16px; width: 95vw; height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
            `}</style>
        </div>
    );
}

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', padding: '8px 0', borderBottom: '1px dashed #e2e8f0', fontSize: 14 }}>
        <div style={{ color: '#64748b', fontWeight: 600 }}>{label}:</div>
        <div style={{ color: '#1e293b', fontWeight: 700 }}>{value}</div>
    </div>
);

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thRow: CSSProperties = { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" };
const th: CSSProperties = { padding: "14px 16px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#64748b" };
const trStyle: CSSProperties = { borderBottom: "1px solid #f1f5f9" };
const td: CSSProperties = { padding: "14px 16px", verticalAlign: "middle", fontSize: 14 };