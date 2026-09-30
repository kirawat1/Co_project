import React, { useState, useEffect } from "react";
import axios from "axios";
import type { CSSProperties } from "react";
import { fmtDate } from '../utils/dateFormat';
import DateInput from './DateInput';
import { notify, askConfirm } from "../utils/notify";
import Modal from "./Modal";
import { useAdminRole } from "./adminRole";
import { getMajorFilter, NO_MAJOR } from "../utils/majorFilter";

// รอบสหกิจ = ปี/เทอม ใช้ร่วมกันทุกหลักสูตร · วันรับสมัคร / เปิด-ปิด / ช่วงนิเทศ ตั้งแยกหลักสูตร
type PeriodRow = {
    periodId: number;
    major: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    supervisionStartDate: string | null;
    supervisionEndDate: string | null;
    isSupervisionOpen: boolean;
    configured?: boolean;
};

type CoopPeriod = {
    id: number;
    academicYear: string;
    semester: number;
    startDate: string;
    endDate: string;
    isActive: boolean;
    majors: PeriodRow[];
};

type ModalState =
    | { mode: "create" }
    | { mode: "term"; period: CoopPeriod }
    | { mode: "row"; period: CoopPeriod; major: string };

const errMsg = (err: any, fallback: string) => err?.response?.data?.message || err?.response?.data?.error || fallback;
const toInput = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

export default function A_CoopPeriod() {
    const { isStaff, majors: myMajors } = useAdminRole();
    const [periods, setPeriods] = useState<CoopPeriod[]>([]);
    const [allMajors, setAllMajors] = useState<string[]>([]);
    const [modal, setModal] = useState<ModalState | null>(null);

    // Form State
    const [academicYear, setAcademicYear] = useState(new Date().getFullYear() + 543 + "");
    const [semester, setSemester] = useState<number>(1);
    const [startDate, setStartDate] = useState(toInput());
    const [endDate, setEndDate] = useState(toInput());

    // หลักสูตรที่แสดงบนหน้านี้ = ตามตัวกรองด้านบน → ไม่งั้นทุกหลักสูตร (เจ้าหน้าที่) / ที่ดูแล (อาจารย์ประจำวิชา)
    const filter = getMajorFilter();
    const scopeMajors = isStaff ? allMajors : myMajors;
    const shownMajors = filter && filter !== NO_MAJOR && scopeMajors.includes(filter) ? [filter] : scopeMajors;

    /* ================= LOAD DATA ================= */
    const fetchPeriods = async () => {
        try {
            const res = await axios.get("/api/admin/coop-periods");
            if (res.data.ok) setPeriods(res.data.periods);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { fetchPeriods(); }, []);
    useEffect(() => {
        if (!isStaff) return;
        axios.get("/api/admin/majors").then(r => { if (r.data?.ok) setAllMajors(r.data.majors ?? []); }).catch(() => {});
    }, [isStaff]);

    /* ================= ACTIONS ================= */
    const openCreate = () => {
        setAcademicYear(new Date().getFullYear() + 543 + "");
        setSemester(1);
        setStartDate(toInput());
        setEndDate(toInput());
        setModal({ mode: "create" });
    };

    const openTerm = (p: CoopPeriod) => {
        setAcademicYear(p.academicYear);
        setSemester(p.semester);
        setStartDate(toInput(p.startDate));
        setEndDate(toInput(p.endDate));
        setModal({ mode: "term", period: p });
    };

    // แก้วันรับสมัครของหลักสูตร (ยังไม่ได้ตั้ง = ตั้งใหม่ โดยเริ่มจากวันตั้งต้นของรอบ)
    const openRow = (p: CoopPeriod, major: string) => {
        const r = p.majors.find(x => x.major === major && x.configured !== false);
        setStartDate(toInput(r?.startDate ?? p.startDate));
        setEndDate(toInput(r?.endDate ?? p.endDate));
        setModal({ mode: "row", period: p, major });
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modal) return;
        try {
            if (modal.mode === "create") {
                if (!academicYear.trim()) return notify.warning("กรุณากรอกปีการศึกษา");
                const res = await axios.post("/api/admin/coop-periods", { academicYear, semester: Number(semester), startDate, endDate });
                const added: string[] = res.data?.added ?? [];
                notify.success(`สร้างรอบ ${semester}/${academicYear} แล้ว${added.length ? ` (${added.join(", ")})` : ""}`);
            } else if (modal.mode === "term") {
                await axios.put(`/api/admin/coop-periods/${modal.period.id}`, { academicYear, semester: Number(semester), startDate, endDate });
            } else {
                await axios.put(`/api/admin/coop-periods/${modal.period.id}`, { major: modal.major, startDate, endDate });
            }
            setModal(null);
            fetchPeriods();
        } catch (err) {
            console.error(err);
            notify.error(errMsg(err, "เกิดข้อผิดพลาดในการบันทึก"));
        }
    };

    const toggle = async (p: CoopPeriod, major: string | null, open: boolean) => {
        const label = `${p.semester}/${p.academicYear}`;
        const who = major ? `หลักสูตร ${major}` : "ทุกหลักสูตร";
        if (open) {
            // เปิดรอบนี้ = ปิดรอบอื่นของหลักสูตรเดียวกัน
            const targets = major ? [major] : p.majors.map(r => r.major);
            const others = periods.filter(o => o.id !== p.id).flatMap(o => o.majors.filter(r => r.isActive && targets.includes(r.major)).map(r => `${r.major} รอบ ${o.semester}/${o.academicYear}`));
            const msg = others.length
                ? `เปิดรับสมัครรอบ ${label} ของ${who}\nรอบที่เปิดอยู่จะถูกปิด: ${others.join(", ")}`
                : `เปิดรับสมัครรอบ ${label} ของ${who}?`;
            if (!(await askConfirm(msg, { confirmLabel: "เปิดรับสมัคร" }))) return;
        } else if (!(await askConfirm(`ปิดรับสมัครรอบ ${label} ของ${who}?`, { confirmLabel: "ปิดรับสมัคร", danger: true, icon: "🔒" }))) return;
        try {
            await axios.patch(`/api/admin/coop-periods/${p.id}/toggle`, { isActive: open, ...(major ? { major } : {}) });
            fetchPeriods();
        } catch (err) {
            console.error(err);
            notify.error(errMsg(err, "ไม่สามารถเปลี่ยนสถานะได้"));
        }
    };

    const removeRow = async (p: CoopPeriod, major: string) => {
        if (!(await askConfirm(`เอารอบ ${p.semester}/${p.academicYear} ออกจากหลักสูตร ${major}?\nหลักสูตรนี้จะไม่มีรอบนี้ (ปิดรับสมัครและปิดนัดนิเทศ)`, { confirmLabel: "เอาออก", danger: true }))) return;
        try {
            await axios.delete(`/api/admin/coop-periods/${p.id}/majors/${encodeURIComponent(major)}`);
            fetchPeriods();
        } catch (err) {
            console.error(err);
            notify.error(errMsg(err, "เอาออกไม่สำเร็จ"));
        }
    };

    const removeTerm = async (p: CoopPeriod) => {
        if (!(await askConfirm(`ลบรอบ ${p.semester}/${p.academicYear} ของทุกหลักสูตร?\n(ลบไม่ได้ถ้ามีนักศึกษาอยู่ในรอบนี้)`, { confirmLabel: "ลบรอบ", danger: true }))) return;
        try {
            await axios.delete(`/api/admin/coop-periods/${p.id}`);
            fetchPeriods();
        } catch (err) {
            console.error(err);
            notify.error(errMsg(err, "ลบไม่สำเร็จ"));
        }
    };

    /* ================= RENDER ================= */
    const modalTitle = !modal ? "" : modal.mode === "create" ? "✨ สร้างรอบรับสมัครใหม่"
        : modal.mode === "term" ? "✏️ แก้ไขปี/ภาคเรียน" : `✏️ วันรับสมัคร หลักสูตร ${modal.major} · รอบ ${modal.period.semester}/${modal.period.academicYear}`;

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER SECTION */}
            <section style={{ ...card, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📅 จัดการรอบรับสมัครสหกิจศึกษา</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
                        ปีการศึกษา/ภาคเรียนใช้ร่วมกันทุกหลักสูตร · วันรับสมัครและการเปิด-ปิด ตั้งแยกแต่ละหลักสูตร
                    </div>
                </div>
                <button className="btn" onClick={openCreate}>+ สร้างรอบใหม่</button>
            </section>

            {/* LIST SECTION */}
            <section style={card}>
                <h3 style={sectionTitle}>รายการรอบ</h3>

                {periods.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>ยังไม่มีข้อมูลรอบรับสมัคร</div>
                ) : (
                    <div style={{ display: 'grid', gap: 16 }}>
                        {periods.map(p => {
                            const configured = new Map(p.majors.filter(r => r.configured !== false).map(r => [r.major, r]));
                            const majors = Array.from(new Set([...shownMajors, ...configured.keys()])).filter(m => shownMajors.length === 0 || shownMajors.includes(m)).sort();
                            const rowsShown = majors.map(m => configured.get(m)).filter(Boolean) as PeriodRow[];
                            const anyOpen = rowsShown.some(r => r.isActive);
                            return (
                                <div key={p.id} style={listItem}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                        <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>
                                            ปีการศึกษา {p.academicYear} เทอม {p.semester}
                                        </div>
                                        {isStaff && (
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {rowsShown.length > 1 && (
                                                    <button className={anyOpen ? "btn-secondary small" : "btn-success small"} onClick={() => toggle(p, null, !anyOpen)}>
                                                        {anyOpen ? "ปิดทุกหลักสูตร" : "เปิดทุกหลักสูตร"}
                                                    </button>
                                                )}
                                                <button className="btn-secondary small" onClick={() => openTerm(p)}>แก้ไขปี/เทอม</button>
                                                <button className="btn-danger small" onClick={() => removeTerm(p)}>ลบรอบ</button>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ overflowX: 'auto', marginTop: 12 }}>
                                        <table style={table}>
                                            <thead>
                                                <tr>
                                                    <th style={th}>หลักสูตร</th>
                                                    <th style={th}>ช่วงรับสมัคร</th>
                                                    <th style={th}>สถานะ</th>
                                                    <th style={th}>ช่วงนิเทศ</th>
                                                    <th style={{ ...th, textAlign: 'right' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {majors.map(m => {
                                                    const r = configured.get(m);
                                                    if (!r) return (
                                                        <tr key={m}>
                                                            <td style={td}><strong>{m}</strong></td>
                                                            <td style={{ ...td, color: '#94a3b8' }} colSpan={3}>ยังไม่ได้ตั้งรอบนี้ (ถือว่าปิด)</td>
                                                            <td style={{ ...td, textAlign: 'right' }}>
                                                                <button className="btn-secondary small" onClick={() => openRow(p, m)}>ตั้งวันรับสมัคร</button>
                                                            </td>
                                                        </tr>
                                                    );
                                                    return (
                                                        <tr key={m}>
                                                            <td style={td}><strong>{m}</strong></td>
                                                            <td style={td}>{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</td>
                                                            <td style={td}>
                                                                <span style={r.isActive ? badgeActive : badgeInactive}>{r.isActive ? '🟢 เปิดรับสมัคร' : '⚫ ปิดรับสมัคร'}</span>
                                                            </td>
                                                            <td style={{ ...td, color: '#64748b' }}>
                                                                {r.isSupervisionOpen ? '🟢 ' : '⚫ '}
                                                                {r.supervisionStartDate || r.supervisionEndDate
                                                                    ? `${r.supervisionStartDate ? fmtDate(r.supervisionStartDate) : '…'} – ${r.supervisionEndDate ? fmtDate(r.supervisionEndDate) : '…'}`
                                                                    : 'ยังไม่ตั้ง'}
                                                            </td>
                                                            <td style={{ ...td, textAlign: 'right' }}>
                                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                    <button className={r.isActive ? "btn-danger small" : "btn-success small"} onClick={() => toggle(p, m, !r.isActive)}>
                                                                        {r.isActive ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}
                                                                    </button>
                                                                    <button className="btn-secondary small" onClick={() => openRow(p, m)}>แก้วัน</button>
                                                                    <button className="btn-secondary small" title="หลักสูตรนี้ไม่ใช้รอบนี้" onClick={() => removeRow(p, m)}>เอาออก</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div style={{ ...meta, marginTop: 16 }}>ช่วงนิเทศตั้งที่หน้า "จัดการนิเทศ"</div>
            </section>

            {/* MODAL */}
            {modal && (
                <Modal title={modalTitle} onClose={() => setModal(null)}>
                    <form onSubmit={save} style={formGrid}>
                        {modal.mode !== "row" && (
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <div style={field}>
                                    <label style={label}>ปีการศึกษา (เช่น 2569)</label>
                                    <input className="input" required value={academicYear} onChange={e => setAcademicYear(e.target.value)} />
                                </div>
                                <div style={field}>
                                    <label style={label}>ภาคเรียน</label>
                                    <select className="input" value={semester} onChange={e => setSemester(Number(e.target.value))}>
                                        <option value={1}>เทอม 1</option>
                                        <option value={2}>เทอม 2</option>
                                        <option value={3}>เทอม 3 (ฤดูร้อน)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <div style={field}>
                                <label style={label}>{modal.mode === "term" ? "วันเปิดรับสมัคร (ตั้งต้น)" : "วันที่เปิดรับสมัคร"}</label>
                                <DateInput required className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div style={field}>
                                <label style={label}>{modal.mode === "term" ? "วันปิดรับสมัคร (ตั้งต้น)" : "วันที่ปิดรับสมัคร"}</label>
                                <DateInput required className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </div>

                        <div style={meta}>
                            {modal.mode === "create" && (isStaff
                                ? "สร้างให้ทุกหลักสูตรด้วยวันเดียวกัน (แก้วันแต่ละหลักสูตรได้ทีหลัง) · ถ้าปี/เทอมนี้มีแล้ว จะเพิ่มให้หลักสูตรที่ยังไม่มี"
                                : `สร้างให้หลักสูตร ${myMajors.join(", ")} · ถ้าปี/เทอมนี้มีแล้ว (หลักสูตรอื่นสร้างไว้) จะเพิ่มของหลักสูตรคุณเข้าไป`)}
                            {modal.mode === "term" && "เปลี่ยนชื่อปี/เทอมมีผลกับทุกหลักสูตร · วันตั้งต้นใช้กับหลักสูตรที่เพิ่มทีหลัง ไม่ทับวันของแต่ละหลักสูตร"}
                        </div>

                        <div style={{ display: "flex", gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>ยกเลิก</button>
                            <button className="btn" type="submit">บันทึกข้อมูล</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}

/* ================= STYLES ================= */
const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 30, border: "1px solid #f1f5f9", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" };
const sectionTitle: CSSProperties = { margin: "0 0 20px 0", fontSize: 18, fontWeight: 700, color: "#334155" };
const formGrid: CSSProperties = { display: "grid", gap: 16 };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, flex: 1 };
const label: CSSProperties = { fontSize: 13, fontWeight: 600, color: '#475569' };

const listItem: CSSProperties = { minWidth: 0, padding: 16, border: "1px solid #e2e8f0", borderRadius: 12, background: '#f8fafc' };
const meta: CSSProperties = { fontSize: 13, color: "#64748b" };
const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const th: CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0' };
const td: CSSProperties = { padding: '10px', borderBottom: '1px solid #eef2f7', color: '#334155', verticalAlign: 'middle' };

// Badges
const badgeActive: CSSProperties = { background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: '1px solid #bbf7d0', whiteSpace: 'nowrap' };
const badgeInactive: CSSProperties = { background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
