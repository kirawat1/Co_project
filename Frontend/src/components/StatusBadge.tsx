import React from "react";

export type CoopStatusType =
    // --- Zone 1-3 ---
    | "NOT_SUBMITTED" | "APPLYING" | "QUALIFICATION_FAILED" | "APPLICATION_EDITS_REQUIRED" | "QUALIFIED"
    | "WAITING_FOR_STAFF_CHECK" | "EDITS_REQUIRED" | "DOCS_APPROVED" | "REQ_LETTER_ISSUED"
    | "WAITING_FOR_PLACEMENT_LETTER" | "WAITING_FOR_STAFF_CHECK_LETTER" | "ACCEPTANCE_CHECKED" | "PLACEMENT_LETTER_ISSUED"
    // --- Zone 4 (Main) ---
    | "INTERNSHIP_STARTED"
    // --- Sub Status (Documents & Supervision) ---
    | "T002_SUBMITTED" | "T002_EDITS_REQUIRED"
    | "T003_SUBMITTED" | "T003_EDITS_REQUIRED"
    | "T004_SUBMITTED" | "T004_EDITS_REQUIRED"
    | "PENDING_TEACHER" | "TEACHER_REJECTED" | "DATE_CONFIRMED" | "LETTER_UPLOADED" | "COMPLETED"
    | string;

// Config สำหรับ Map สีและข้อความ
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon?: string; isInternship?: boolean }> = {

    // ... (Zone 1-3 ใส่เหมือนเดิมที่คุณมี) ...
    NOT_SUBMITTED: { label: "ยังไม่ยื่นสหกิจ", color: "#64748b", bg: "#f1f5f9", icon: "⚪" },
    APPLYING: { label: "รอตรวจสอบคุณสมบัติ", color: "#854d0e", bg: "#fef9c3", icon: "⏳" },
    QUALIFIED: { label: "ผ่านคุณสมบัติ", color: "#166534", bg: "#dcfce7", icon: "✅" },
    QUALIFICATION_FAILED: { label: "ไม่ผ่านคุณสมบัติ", color: "#dc2626", bg: "#fef2f2", icon: "❌" },
    APPLICATION_EDITS_REQUIRED: { label: "แก้ไขใบสมัคร", color: "#c2410c", bg: "#fff7ed", icon: "📝" },

    // --- Phase 2: เอกสาร T000 ---
    WAITING_FOR_STAFF_CHECK: { label: "รอตรวจเอกสาร", color: "#1e40af", bg: "#eff6ff", icon: "🔍" }, // น้ำเงิน
    EDITS_REQUIRED: { label: "แก้ไขเอกสาร T000", color: "#c2410c", bg: "#fff7ed", icon: "⚠️" }, // ส้ม
    DOCS_APPROVED: { label: "เอกสารผ่าน (รอหนังสือ)", color: "#15803d", bg: "#dcfce7", icon: "✨" }, // เขียว

    // --- Phase 3: ขอความอนุเคราะห์ ---
    REQ_LETTER_ISSUED: { label: "ออกหนังสือขอความอนุเคราะห์แล้ว", color: "#6b21a8", bg: "#f3e8ff", icon: "🚚" }, // ม่วง
    PLACEMENT_LETTER_ISSUED: { label: "ออกหนังสือส่งตัวแล้ว", color: "#047857", bg: "#d1fae5", icon: "🏁" },
    WAITING_FOR_PLACEMENT_LETTER: { label: "รอใบตอบรับ", color: "#0891b2", bg: "#ecfeff", icon: "🏢" }, // ฟ้า Cyan
    WAITING_FOR_STAFF_CHECK_LETTER: { label: "รอตรวจใบตอบรับ", color: "#d97706", bg: "#fffbeb", icon: "🕵️" }, // เหลืองเข้ม Amber
    ACCEPTANCE_CHECKED: { label: "ตรวจใบตอบรับแล้ว", color: "#059669", bg: "#d1fae5", icon: "✨" }, // เขียวมินต์ Emerald
    // ==========================================
    // --- Zone 4: ปฏิบัติงาน (ใส่ isInternship: true) ---
    // ==========================================
    INTERNSHIP_STARTED: { label: "ออกฝึกสหกิจ", color: "#4338ca", bg: "#e0e7ff", icon: "🚀", isInternship: true },

    // --- เอกสาร T002 - T006 ---
    T002_SUBMITTED: { label: "ส่งเอกสาร T002 แล้ว", color: "#0d9488", bg: "#ccfbf1", icon: "📄", isInternship: true },
    T002_EDITS_REQUIRED: { label: "ต้องแก้ไข T002", color: "#dc2626", bg: "#fef2f2", icon: "⚠️", isInternship: true },
    T003_SUBMITTED: { label: "ส่งโครงร่าง T003 แล้ว", color: "#0d9488", bg: "#ccfbf1", icon: "📘", isInternship: true },
    T003_EDITS_REQUIRED: { label: "ต้องแก้ไขโครงร่าง T003", color: "#dc2626", bg: "#fef2f2", icon: "⚠️", isInternship: true },
    T004_SUBMITTED: { label: "ส่งรายงาน T004 แล้ว", color: "#0d9488", bg: "#ccfbf1", icon: "📗", isInternship: true },
    T004_EDITS_REQUIRED: { label: "ต้องแก้ไขรายงาน T004", color: "#dc2626", bg: "#fef2f2", icon: "⚠️", isInternship: true },

    // --- การนิเทศ (Supervision) ---
    PENDING_TEACHER: { label: "รออาจารย์เลือกวันนิเทศ", color: "#d97706", bg: "#fffbeb", icon: "⏳", isInternship: true },
    TEACHER_REJECTED: { label: "แก้ไขวันนัดหมายนิเทศ", color: "#dc2626", bg: "#fef2f2", icon: "⚠️", isInternship: true },
    DATE_CONFIRMED: { label: "รอเจ้าหน้าที่พิจารณาหนังสือนิเทศ", color: "#0284c7", bg: "#e0f2fe", icon: "🔍", isInternship: true },
    LETTER_UPLOADED: { label: "อนุมัติหนังสือนิเทศแล้ว", color: "#16a34a", bg: "#dcfce7", icon: "✅", isInternship: true },
    COMPLETED: { label: "นิเทศเสร็จสิ้น", color: "#6b21a8", bg: "#f3e8ff", icon: "🎉", isInternship: true },

    WAITING: { label: "รอดำเนินการ", color: "#64748b", bg: "#f1f5f9", icon: "⚪" },
};

interface Props {
    status?: CoopStatusType | null;
    showIcon?: boolean;
    // ✅ เพิ่ม Option ให้บังคับปิดคำว่า "กำลังฝึกสหกิจ :" ได้ เผื่อบางหน้าไม่อยากให้ยาวเกินไป
    hidePrefix?: boolean;
}

export default function StatusBadge({ status, showIcon = true, hidePrefix = false }: Props) {
    const config = STATUS_CONFIG[status || "WAITING"] || STATUS_CONFIG["WAITING"];

    // ✅ Logic: ถ้าเป็นสถานะตอนฝึกงาน และไม่ได้สั่งซ่อน Prefix ให้เติมคำนำหน้า
    const displayLabel = (config.isInternship && !hidePrefix)
        ? `กำลังฝึกสหกิจ : ${config.label}`
        : config.label;

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "99px",
                fontSize: "12px",
                fontWeight: 700,
                whiteSpace: "nowrap",
                color: config.color,
                backgroundColor: config.bg,
                border: `1px solid ${config.color}30`
            }}
        >
            {showIcon && <span>{config.icon}</span>}
            {displayLabel}
        </span>
    );
}