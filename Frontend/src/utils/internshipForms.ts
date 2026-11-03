// ฟอร์มช่วงฝึกสหกิจ T002/T003 — "เท่ากัน ไม่ต่อกัน" (ตรงกับ backend/utils/internshipForms.js)
//   สถานะหลักคงที่ที่ INTERNSHIP_STARTED (แสดงว่า "ส่งเอกสารฝึกสหกิจ") · สถานะของแต่ละฟอร์มอ่านจากไฟล์ล่าสุดของฟอร์มนั้น
export type FormState = "NONE" | "WAITING" | "REJECTED" | "APPROVED";
export type FormKey = "T002" | "T003";

export interface FormDocLike {
    id?: number;
    type?: string | null;
    status?: string | null;
}

const FORM_TYPES: Record<FormKey, string> = { T002: "T002_FORM", T003: "T003_FORM" };

// สถานะหลักแบบเก่าที่ยังค้างใน DB จนกว่าจะรันสคริปต์ migrate — ปฏิบัติเหมือน INTERNSHIP_STARTED
export const LEGACY_INTERNSHIP_STATUSES = ["T002_SUBMITTED", "T002_EDITS_REQUIRED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "T003_APPROVED"];
export const INTERNSHIP_STATUSES = ["INTERNSHIP_STARTED", ...LEGACY_INTERNSHIP_STATUSES];

export const MAIN_STATUS_LABEL = "ส่งเอกสารฝึกสหกิจ";
export const FORMS_DONE_LABEL = "เอกสารฝึกสหกิจครบ";
export const FORM_STATE_LABEL: Record<FormState, string> = { NONE: "ยังไม่ส่ง", WAITING: "รอตรวจ", REJECTED: "ต้องแก้", APPROVED: "ผ่าน" };

export const isInternshipStatus = (status?: string | null): boolean => INTERNSHIP_STATUSES.includes(status || "");

/** สถานะย่อยของฟอร์มจากไฟล์ล่าสุด */
export function formState(doc?: FormDocLike | null): FormState {
    if (!doc) return "NONE";
    if (doc.status === "WAITING" || doc.status === "PENDING") return "WAITING";
    if (doc.status === "REJECTED" || doc.status === "EDITS_REQUIRED") return "REJECTED";
    return "APPROVED";
}

/** ส่งฟอร์มได้: อยู่ช่วงฝึกงาน และยังไม่เคยส่ง หรือถูกตีกลับ */
export const canSubmitForm = (coopStatus: string | null | undefined, state: FormState): boolean =>
    isInternshipStatus(coopStatus) && (state === "NONE" || state === "REJECTED");

/** ปุ่มตรวจ: รอตรวจ = ผ่าน/ตีกลับ · ผ่านแล้ว = ตีกลับย้อนหลังได้ · ที่เหลือตรวจไม่ได้ */
export function reviewActions(coopStatus: string | null | undefined, state: FormState): { approve: boolean; reject: boolean } {
    if (!isInternshipStatus(coopStatus)) return { approve: false, reject: false };
    if (state === "WAITING") return { approve: true, reject: true };
    if (state === "APPROVED") return { approve: false, reject: true };
    return { approve: false, reject: false };
}

/** ไฟล์ล่าสุด (id มากสุด) ของฟอร์มนั้นในรายการเอกสาร */
export function latestForm<T extends FormDocLike>(documents: T[] | null | undefined, key: FormKey): T | undefined {
    let best: T | undefined;
    for (const d of documents || []) {
        if (d.type !== FORM_TYPES[key]) continue;
        if (!best || (d.id ?? 0) > (best.id ?? 0)) best = d;
    }
    return best;
}

/** ผ่านครบทั้งสองฟอร์ม */
export const formsDone = (t002: FormState, t003: FormState): boolean => t002 === "APPROVED" && t003 === "APPROVED";
