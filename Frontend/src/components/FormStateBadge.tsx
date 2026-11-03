import { FORM_STATE_LABEL, type FormState } from "../utils/internshipForms";

// ป้ายสถานะของฟอร์ม T002/T003 (ยังไม่ส่ง / รอตรวจ / ต้องแก้ / ผ่าน) — อ่านจากไฟล์ล่าสุดของฟอร์มนั้น
const STYLE: Record<FormState, { color: string; bg: string; icon: string }> = {
    NONE: { color: "#64748b", bg: "#f1f5f9", icon: "⚪" },
    WAITING: { color: "#854d0e", bg: "#fef9c3", icon: "⏳" },
    REJECTED: { color: "#dc2626", bg: "#fef2f2", icon: "⚠️" },
    APPROVED: { color: "#166534", bg: "#dcfce7", icon: "✅" },
};

export default function FormStateBadge({ state, name }: { state: FormState; name: string }) {
    const s = STYLE[state];
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, color: s.color, background: s.bg }}>
            <span>{s.icon}</span>{name}: {FORM_STATE_LABEL[state]}
        </span>
    );
}
