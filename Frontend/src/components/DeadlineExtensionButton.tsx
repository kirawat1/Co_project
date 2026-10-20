// ขยายเวลาส่งรายคน (ปฏิทินของรอบ) — T000/T002/T003 · ส่งได้ถึงสิ้นวันที่ขยาย แต่ยังนับว่าส่งช้า
// เจ้าหน้าที่ / อาจารย์ประจำวิชาของหลักสูตรนักศึกษา · เหตุผลเก็บในบันทึกการใช้งาน
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import Modal from "./Modal";
import DateInput from "./DateInput";
import { notify } from "../utils/notify";
import { fmtDate } from "../utils/dateFormat";
import { MODE_STEPS, STEP_LABEL, extensionSummary, type StepKey } from "../utils/deadlines";

type Extensions = Partial<Record<StepKey, string>>;

interface Props {
    studentId: number;                  // Student.id
    studentName?: string;
    extensions?: Extensions | null;     // StudentCoop.deadlineExtensions
    step?: StepKey;                     // ขั้นที่หน้านี้ดูแล (ไม่ระบุ = เลือกได้)
    onChanged?: (ext: Extensions) => void;
    compact?: boolean;                  // ปุ่มเล็กในแถวตาราง
}

const todayBangkok = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

export default function DeadlineExtensionButton({ studentId, studentName, extensions, step, onChanged, compact }: Props) {
    const [ext, setExt] = useState<Extensions>(extensions || {});
    // ข้อมูลใหม่จากหน้า (รีโหลดรายการ) → ใช้ค่าใหม่
    const extKey = JSON.stringify(extensions || {});
    useEffect(() => { setExt(extensions || {}); }, [extKey]); // eslint-disable-line react-hooks/exhaustive-deps
    const [open, setOpen] = useState(false);
    const [stepKey, setStepKey] = useState<StepKey>(step || "T000");
    const [until, setUntil] = useState("");
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    const current = step ? (ext[step] ? `ขยายถึง ${fmtDate(ext[step]!)}` : "") : extensionSummary(ext);
    const update = (next: Extensions) => { setExt(next); onChanged?.(next); };

    const openDialog = () => {
        setStepKey(step || "T000");
        setUntil(ext[step || "T000"] || "");
        setReason("");
        setOpen(true);
    };

    const save = async () => {
        if (!until) return notify.warning("กรุณาเลือกวันที่ขยายถึง");
        if (until < todayBangkok()) return notify.warning("วันที่ขยายถึงต้องไม่ย้อนหลัง");
        setSaving(true);
        try {
            const res = await axios.put(`/api/admin/students/${studentId}/deadline-extension`, { stepKey, until, reason });
            update(res.data?.deadlineExtensions || { ...ext, [stepKey]: until });
            notify.success(`ขยายเวลา ${stepKey} ถึง ${fmtDate(until)} แล้ว`);
            setOpen(false);
        } catch (err: any) {
            notify.error(err?.response?.data?.message || "ขยายเวลาไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    const clear = async () => {
        setSaving(true);
        try {
            const res = await axios.delete(`/api/admin/students/${studentId}/deadline-extension/${stepKey}`);
            update(res.data?.deadlineExtensions || (() => { const n = { ...ext }; delete n[stepKey]; return n; })());
            notify.success(`ยกเลิกการขยายเวลา ${stepKey} แล้ว`);
            setOpen(false);
        } catch (err: any) {
            notify.error(err?.response?.data?.message || "ยกเลิกไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <button type="button" className={compact ? "btn-secondary small" : "btn-secondary"} onClick={openDialog}
                title={current || "ขยายเวลาส่งให้นักศึกษาคนนี้ (เลยกำหนดแบบปิดรับแล้วส่งได้ถึงวันที่ขยาย)"}>
                {current ? (compact ? "ขยายเวลาแล้ว" : `ขยายเวลา (${current})`) : "ขยายเวลา"}
            </button>
            {/* วาดที่ body — ปุ่มนี้อยู่ในฟอร์มแก้ข้อมูลนักศึกษาได้ กด Enter ในหน้าต่างนี้ต้องไม่ไปส่งฟอร์มนั้น */}
            {open && createPortal(
                <Modal title={`ขยายเวลาส่ง${studentName ? ` — ${studentName}` : ""}`} onClose={() => !saving && setOpen(false)} maxWidth={460}>
                    <div style={{ display: "grid", gap: 12 }}>
                        {!step && (
                            <label style={field}>
                                ขั้น
                                <select className="input" value={stepKey} onChange={e => { const k = e.target.value as StepKey; setStepKey(k); setUntil(ext[k] || ""); }}>
                                    {MODE_STEPS.map(k => <option key={k} value={k}>{STEP_LABEL[k]}</option>)}
                                </select>
                            </label>
                        )}
                        <label style={field}>
                            ส่งได้ถึง (สิ้นวัน เวลาไทย)
                            <DateInput className="input" value={until} onChange={e => setUntil(e.target.value)} />
                        </label>
                        <label style={field}>
                            เหตุผล (เก็บในบันทึกการใช้งาน)
                            <input className="input" value={reason} maxLength={200} onChange={e => setReason(e.target.value)} placeholder="เช่น บริษัทเริ่มงานช้ากว่ากำหนด" />
                        </label>
                        <div style={{ fontSize: 12, color: "#64748b" }}>ส่งภายในวันที่ขยายได้ แต่ระบบยังติดป้าย "ส่งช้า" (เทียบกับกำหนดส่งของรอบ)</div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div>
                                {ext[stepKey] && (
                                    <button type="button" className="btn-danger small" disabled={saving} onClick={clear}>ยกเลิกการขยาย {stepKey}</button>
                                )}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" className="btn-secondary" disabled={saving} onClick={() => setOpen(false)}>ยกเลิก</button>
                                <button type="button" className="btn" disabled={saving} onClick={save}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
                            </div>
                        </div>
                    </div>
                </Modal>,
                document.body,
            )}
        </>
    );
}

const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#475569" };
