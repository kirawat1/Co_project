import React from "react";

// Enum สถานะทั้งหมดที่มีในระบบ
export type CoopStatusType =
    | "NOT_SUBMITTED"               // ยังไม่ยื่นสหกิจ
    | "APPLYING"
    | "QUALIFICATION_FAILED"
    | "QUALIFIED"
    | "WAITING_FOR_STAFF_CHECK"
    | "APPLICATION_EDITS_REQUIRED" // แก้ใบสมัคร
    | "EDITS_REQUIRED"             // แก้ T000
    | "DOCS_APPROVED"
    | "REQ_LETTER_ISSUED"
    // ✅ เพิ่มสถานะใหม่ช่วงส่งตัว
    | "WAITING_FOR_PLACEMENT_LETTER"   // นศ. โหลดหนังสือแล้ว รอไปยื่นและเอาใบตอบรับมาส่ง
    | "WAITING_FOR_STAFF_CHECK_LETTER" // นศ. อัปโหลดใบตอบรับแล้ว รอ จนท. ตรวจ
    | 'ACCEPTANCE_CHECKED'          // จนท. ตรวจใบตอบรับผ่านแล้ว
    | "PLACEMENT_LETTER_ISSUED"        // จนท. ออกหนังสือส่งตัวจริงแล้ว
    | "INTERNSHIP_STARTED"             // เริ่มฝึกงาน
    | "REJECTED"
    | "WAITING"
    | string;

// Config สำหรับ Map สีและข้อความ
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon?: string }> = {
    // --- Phase 1: ใบสมัคร ---
    NOT_SUBMITTED: { label: "ยังไม่ยื่นสหกิจ", color: "#64748b", bg: "#f1f5f9", icon: "⚪" }, // เทา
    APPLYING: { label: "รอตรวจสอบคุณสมบัติ", color: "#854d0e", bg: "#fef9c3", icon: "⏳" }, // เหลือง
    QUALIFICATION_FAILED: { label: "ไม่ผ่านคุณสมบัติ", color: "#991b1b", bg: "#fee2e2", icon: "❌" }, // แดง
    QUALIFIED: { label: "ผ่านคุณสมบัติ", color: "#166534", bg: "#dcfce7", icon: "✅" }, // เขียว
    APPLICATION_EDITS_REQUIRED: { label: "แก้ไขใบสมัคร", color: "#c2410c", bg: "#fff7ed", icon: "📝" }, // ส้ม

    // --- Phase 2: เอกสาร T000 ---
    WAITING_FOR_STAFF_CHECK: { label: "รอตรวจเอกสาร", color: "#1e40af", bg: "#eff6ff", icon: "🔍" }, // น้ำเงิน
    EDITS_REQUIRED: { label: "แก้ไขเอกสาร T000", color: "#c2410c", bg: "#fff7ed", icon: "⚠️" }, // ส้ม
    DOCS_APPROVED: { label: "เอกสารผ่าน (รอหนังสือ)", color: "#15803d", bg: "#dcfce7", icon: "✨" }, // เขียว

    // --- Phase 3: ขอความอนุเคราะห์ ---
    REQ_LETTER_ISSUED: { label: "ออกหนังสือขอความอนุเคราะห์แล้ว", color: "#6b21a8", bg: "#f3e8ff", icon: "🚚" }, // ม่วง

    // --- Phase 4: ส่งตัว (ใหม่) ---
    WAITING_FOR_PLACEMENT_LETTER: { label: "รอใบตอบรับ", color: "#0891b2", bg: "#ecfeff", icon: "🏢" }, // ฟ้า Cyan
    WAITING_FOR_STAFF_CHECK_LETTER: { label: "รอตรวจใบตอบรับ", color: "#d97706", bg: "#fffbeb", icon: "🕵️" }, // เหลืองเข้ม Amber
    ACCEPTANCE_CHECKED: { label: "ตรวจใบตอบรับแล้ว", color: "#059669", bg: "#d1fae5", icon: "✨" }, // เขียวมินต์ Emerald
    PLACEMENT_LETTER_ISSUED: { label: "ออกใบส่งตัวแล้ว", color: "#047857", bg: "#d1fae5", icon: "🏁" }, // เขียวเข้ม Emerald
    INTERNSHIP_STARTED: { label: "กำลังฝึกงาน", color: "#4338ca", bg: "#e0e7ff", icon: "🚀" }, // น้ำเงินเข้ม Indigo

    // --- General ---
    REJECTED: { label: "ไม่ผ่าน", color: "#991b1b", bg: "#fee2e2", icon: "❌" },
    WAITING: { label: "ยังไม่ดำเนินการ", color: "#64748b", bg: "#f1f5f9", icon: "⚪" },
};

interface Props {
    status?: CoopStatusType | null;
    showIcon?: boolean;
}

export default function StatusBadge({ status, showIcon = true }: Props) {
    // ถ้าไม่มี status ส่งมา หรือหาไม่เจอใน Config ให้ใช้ค่า Default
    const config = STATUS_CONFIG[status || "WAITING"] || STATUS_CONFIG["WAITING"];

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 10px",
                borderRadius: "99px",
                fontSize: "12px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                color: config.color,
                backgroundColor: config.bg,
                border: `1px solid ${config.color}30` // ใส่ขอบจางๆ
            }}
        >
            {showIcon && <span>{config.icon}</span>}
            {config.label}
        </span>
    );
}