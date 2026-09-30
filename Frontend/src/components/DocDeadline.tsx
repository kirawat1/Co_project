import type { CSSProperties } from "react";
import DateInput from "./DateInput";
import { fmtDate } from "../utils/dateFormat";

// กำหนดส่งเอกสาร T005–T008 — วันที่ตายตัว (YYYY-MM-DD) ตั้งแยกหลักสูตรได้
// เลยกำหนดแล้วแค่แจ้งว่าเลยกำหนด ลิงก์ยังเปิดได้ (ฟอร์มอยู่นอกระบบ — ถ้าจะปิดรับจริงต้องปิดที่ Google Form)

/** จำนวนวันที่เหลือถึงสิ้นวันกำหนดส่ง (เวลาไทย) — 0 = วันนี้วันสุดท้าย · ติดลบ = เลยกำหนด */
export function daysLeft(deadline: string, now = new Date()): number {
    const today = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
    return Math.round((Date.parse(deadline) - Date.parse(today)) / 86_400_000);
}

/** ช่องตั้งกำหนดส่งในหน้าตั้งค่า (ค่ากลาง) */
export function DeadlineField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label style={labelStyle}>📅 กำหนดส่ง</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 360 }}>
                <DateInput value={value} onChange={e => onChange(e.target.value)} />
                {value && <button type="button" className="btn-secondary small" onClick={() => onChange("")}>ล้าง</button>}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                นักศึกษาเห็นกำหนดส่งและจำนวนวันที่เหลือ · เลยกำหนดแล้วขึ้นว่า "เลยกำหนดส่ง" แต่ลิงก์ยังเปิดได้ (ถ้าจะปิดรับจริงให้ปิดที่ Google Form) · ว่าง = ไม่มีกำหนดส่ง
            </div>
        </div>
    );
}

/** แถบกำหนดส่งในหน้านักศึกษา */
export function DeadlineBanner({ deadline }: { deadline?: string | null }) {
    if (!deadline) return null;
    const left = daysLeft(deadline);
    const overdue = left < 0;
    const soon = !overdue && left <= 3;
    const tone = overdue
        ? { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", icon: "⛔" }
        : soon ? { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: "⏰" }
        : { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", icon: "📅" };
    const status = overdue ? `เลยกำหนดส่งมาแล้ว ${-left} วัน` : left === 0 ? "วันนี้วันสุดท้าย" : `เหลืออีก ${left} วัน`;
    return (
        <div role="status" style={{ ...banner, background: tone.bg, borderColor: tone.border, color: tone.color }}>
            <span style={{ fontSize: 22 }}>{tone.icon}</span>
            <div>
                <div style={{ fontWeight: 700 }}>กำหนดส่ง: {fmtDate(deadline)} · {status}</div>
                {overdue && <div style={{ fontSize: 13, marginTop: 2 }}>ยังเปิดลิงก์ได้ แต่ส่งช้ากว่ากำหนด — ติดต่ออาจารย์ประจำวิชาหากมีปัญหา</div>}
            </div>
        </div>
    );
}

const labelStyle: CSSProperties = { fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 8, display: "block" };
const banner: CSSProperties = { display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", borderRadius: 10, border: "1px solid", marginBottom: 24 };
