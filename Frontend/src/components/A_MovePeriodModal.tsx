import { useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { notify } from "../utils/notify";
import Modal from "./Modal";

// ย้ายรอบสหกิจของนักศึกษา (เช่น ยื่นเทอม 1 แล้วไปไม่ได้ → ไปเทอม 2)
// ยังไม่ผ่านคุณสมบัติ: คงสถานะเดิม / เริ่มยื่นคำร้องใหม่ · ผ่านคุณสมบัติแล้ว: เริ่ม T000 ใหม่ / เริ่มยื่นคำร้องใหม่
// ออกฝึกแล้ว (INTERNSHIP_STARTED / T002 / T003) = ย้ายไม่ได้ — server ตรวจซ้ำทุกเงื่อนไข
export const EARLY_STATUSES = ["NOT_SUBMITTED", "APPLYING", "PENDING_GRADE", "QUALIFICATION_FAILED", "APPLICATION_EDITS_REQUIRED"];
export const MOVE_BLOCKED_STATUSES = ["INTERNSHIP_STARTED", "T002_SUBMITTED", "T002_EDITS_REQUIRED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "T003_APPROVED"];

type Period = { id: number; semester: string | number; academicYear: string };
type ResetTo = "KEEP" | "QUALIFIED" | "NOT_SUBMITTED";

const OPTIONS: Record<ResetTo, { label: string; hint: string }> = {
    KEEP: { label: "คงสถานะเดิม", hint: "ย้ายรอบอย่างเดียว คำร้องและผลตรวจยังอยู่เหมือนเดิม" },
    QUALIFIED: { label: "ผ่านคุณสมบัติแล้ว — เริ่มยื่น T000 ใหม่", hint: "คงผลผ่านคุณสมบัติไว้ · ยกเลิกหนังสือขอความอนุเคราะห์ หนังสือส่งตัว ใบตอบรับ และพี่เลี้ยง" },
    NOT_SUBMITTED: { label: "เริ่มยื่นคำร้องใหม่", hint: "ล้างผลตรวจคุณสมบัติ และยกเลิกหนังสือทั้งหมด นักศึกษาต้องยื่นคำร้องใหม่ในรอบใหม่" },
};

export default function A_MovePeriodModal({ student, periods, onClose, onMoved }: {
    student: { id: number; studentId: string; name: string; status: string; coopPeriodId?: number | null };
    periods: Period[];
    onClose: () => void;
    onMoved: () => void;
}) {
    const early = EARLY_STATUSES.includes(student.status);
    const choices: ResetTo[] = early ? ["KEEP", "NOT_SUBMITTED"] : ["QUALIFIED", "NOT_SUBMITTED"];
    const targets = periods.filter(p => p.id !== student.coopPeriodId);
    const [periodId, setPeriodId] = useState<number | "">(targets[0]?.id ?? "");
    const [resetTo, setResetTo] = useState<ResetTo>(choices[0]);
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!periodId) return notify.warning("กรุณาเลือกรอบที่จะย้ายไป");
        if (!reason.trim()) return notify.warning("กรุณาระบุเหตุผลที่ย้ายรอบ");
        setSaving(true);
        try {
            const res = await apiFetch(`/api/admin/students/${student.id}/move-period`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodId, resetTo, reason: reason.trim() }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.ok) throw new Error(data?.message || "ย้ายรอบไม่สำเร็จ");
            notify.success(data.message || "ย้ายรอบแล้ว");
            onMoved();
        } catch (e: any) {
            notify.error(e?.message || "ย้ายรอบไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={`🔁 ย้ายรอบสหกิจ · ${student.studentId} ${student.name}`} onClose={onClose} maxWidth={560}>
            <div style={{ display: "grid", gap: 16 }}>
                <div>
                    <label style={label}>ย้ายไปรอบ</label>
                    {targets.length === 0
                        ? <div style={{ color: "#b91c1c", fontSize: 14 }}>ยังไม่มีรอบอื่นให้ย้ายไป — สร้างรอบที่หน้ารอบสหกิจก่อน</div>
                        : (
                            <select className="input" aria-label="รอบที่จะย้ายไป" value={periodId} onChange={e => setPeriodId(Number(e.target.value))}>
                                {targets.map(p => <option key={p.id} value={p.id}>เทอม {p.semester}/{p.academicYear}</option>)}
                            </select>
                        )}
                </div>

                <div>
                    <label style={label}>ให้เริ่มใหม่จากขั้นไหน</label>
                    <div style={{ display: "grid", gap: 8 }}>
                        {choices.map(c => (
                            <label key={c} style={{ ...choice, borderColor: resetTo === c ? "#2563eb" : "#e2e8f0", background: resetTo === c ? "#eff6ff" : "#fff" }}>
                                <input type="radio" name="resetTo" checked={resetTo === c} onChange={() => setResetTo(c)} style={{ marginTop: 3 }} />
                                <span>
                                    <strong>{OPTIONS[c].label}</strong>
                                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{OPTIONS[c].hint}</div>
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label style={label}>เหตุผล <span style={{ color: "red" }}>*</span></label>
                    <textarea className="input" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="เช่น บริษัทยกเลิกรับ / ป่วย ขอเลื่อนไปเทอมถัดไป" />
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="btn-secondary" onClick={onClose} disabled={saving}>ยกเลิก</button>
                    <button className="btn" onClick={submit} disabled={saving || targets.length === 0}>{saving ? "กำลังย้าย..." : "ย้ายรอบ"}</button>
                </div>
            </div>
        </Modal>
    );
}

const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 };
const choice: React.CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", border: "1px solid", borderRadius: 10, cursor: "pointer" };
