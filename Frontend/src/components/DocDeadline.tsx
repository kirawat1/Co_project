import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { fmtDate } from "../utils/dateFormat";
import { daysLeft } from "../utils/deadline";

// กำหนดส่งเอกสาร T005–T008 — วันที่ตายตัว (YYYY-MM-DD) ตั้งที่ปฏิทินของรอบ (แยกรอบ × หลักสูตร)
// เลยกำหนดแล้วแค่แจ้งว่าเลยกำหนด ลิงก์ยังเปิดได้ (ฟอร์มอยู่นอกระบบ — ถ้าจะปิดรับจริงต้องปิดที่ Google Form)

/** หน้าตั้งค่าแบบฟอร์ม: กำหนดส่งย้ายไปตั้งที่ปฏิทินของรอบ (แยกรอบ × หลักสูตร) */
export function DeadlineMovedNote() {
    return (
        <div>
            <label style={labelStyle}>📅 กำหนดส่ง</label>
            <div style={{ fontSize: 13, color: "#475569" }}>
                ตั้งแยกตามรอบและหลักสูตรที่ <Link to="/admin/coop-period" style={{ color: "#1d4ed8", fontWeight: 600 }}>หน้ารอบสหกิจ → ปฏิทินของรอบ</Link> ·
                นักศึกษาเห็นกำหนดส่งของรอบตัวเอง · เลยกำหนดแล้วลิงก์ยังเปิดได้ (ฟอร์มอยู่นอกระบบ)
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
