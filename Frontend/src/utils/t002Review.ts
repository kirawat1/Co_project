// ตรวจ T002 — ตรงกับ backend/utils/t002Review.js
// ปกติตรวจตอนสถานะ "ส่ง T002 แล้ว" · นักศึกษาส่ง T003 ได้ทันทีหลังส่ง T002 (ไม่ต้องรอผล) จึงอาจไปขั้น T003 แล้วทั้งที่ T002 ยังไม่ถูกตรวจ
// → ตรวจย้อนหลังได้จนกว่าไฟล์จะถูกตรวจ (เดิมหน้าตรวจขึ้น "รอการตรวจสอบ — ไม่สามารถตรวจสอบซ้ำได้ในสถานะนี้")
// ตีกลับย้อนหลัง = นักศึกษาส่ง T002 ใหม่ได้ ขั้น T003 ไม่ถอย
export const T002_LATE_REVIEW_STATUSES = ["T003_SUBMITTED", "T003_EDITS_REQUIRED", "T003_APPROVED"];
const REVIEWED_DOC = ["APPROVED", "REJECTED", "EDITS_REQUIRED"];

/** ตรวจ T002 ได้ตอนนี้ไหม — coopStatus = สถานะสหกิจ · docStatus = สถานะไฟล์ T002 (ไม่มีไฟล์ = undefined) */
export function t002Reviewable(coopStatus?: string | null, docStatus?: string | null): boolean {
    if (!docStatus) return false;
    if (coopStatus === "T002_SUBMITTED") return true;
    return T002_LATE_REVIEW_STATUSES.includes(coopStatus || "") && !REVIEWED_DOC.includes(docStatus);
}

/** นักศึกษาส่ง T002 ใหม่ได้ไหม (ตอนเริ่มฝึก · ถูกตีกลับ · ถูกตีกลับย้อนหลังตอนอยู่ขั้น T003) */
export function t002CanSubmit(coopStatus?: string | null, docStatus?: string | null): boolean {
    if (coopStatus === "INTERNSHIP_STARTED" || coopStatus === "T002_EDITS_REQUIRED") return true;
    return T002_LATE_REVIEW_STATUSES.includes(coopStatus || "") && docStatus === "REJECTED";
}
