// เครื่องหมายขั้นตอนบนเมนูนักศึกษา — ✓ ผ่านแล้ว / ● ขั้นปัจจุบัน / จาง = ยังไม่ถึง
// เฉพาะขั้นที่บอกได้จากสถานะคำร้องอย่างเดียว (นิเทศ/T005–T008 ไม่มีสถานะของตัวเอง จึงไม่ใส่เครื่องหมาย)
export type StepState = "done" | "current" | "later";
export type StudentStep = "gateway" | "docs" | "t002" | "t003";

// ลำดับสถานะตามขั้นตอนจริง — อนุมัติ T002 แล้วสถานะยังเป็น T002_SUBMITTED และส่ง T003 ได้ตั้งแต่ตอนนั้น
// (T002_SUBMITTED จึงเป็นทั้ง "ขั้นปัจจุบัน" ของ T002 และ T003)
const ORDER = [
  "NOT_SUBMITTED", "APPLYING", "PENDING_GRADE", "APPLICATION_EDITS_REQUIRED", "QUALIFICATION_FAILED",
  "QUALIFIED", "WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED", "DOCS_APPROVED", "REQ_LETTER_ISSUED",
  "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED",
  "INTERNSHIP_STARTED", "T002_EDITS_REQUIRED", "T002_SUBMITTED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "T003_APPROVED",
];
const RANGE: Record<StudentStep, [string, string]> = {
  gateway: ["NOT_SUBMITTED", "QUALIFICATION_FAILED"],
  docs: ["QUALIFIED", "PLACEMENT_LETTER_ISSUED"],
  t002: ["INTERNSHIP_STARTED", "T002_SUBMITTED"],
  t003: ["T002_SUBMITTED", "T003_EDITS_REQUIRED"],
};

/** สถานะไม่รู้จัก → null (ไม่ใส่เครื่องหมาย ดีกว่าบอกผิด) · ยังไม่มีคำร้อง = NOT_SUBMITTED */
export function stepState(step: StudentStep, status?: string | null): StepState | null {
  const i = ORDER.indexOf(status || "NOT_SUBMITTED");
  if (i < 0) return null;
  const [from, to] = RANGE[step].map((s) => ORDER.indexOf(s));
  return i < from ? "later" : i > to ? "done" : "current";
}
