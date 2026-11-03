// เครื่องหมายขั้นตอนบนเมนูนักศึกษา — ✓ ผ่านแล้ว / ● ขั้นปัจจุบัน / จาง = ยังไม่ถึง
// เฉพาะขั้นที่บอกได้จากสถานะคำร้องอย่างเดียว (นิเทศ/T005–T008 ไม่มีสถานะของตัวเอง จึงไม่ใส่เครื่องหมาย)
import { isInternshipStatus, type FormState } from "./internshipForms";

export type StepState = "done" | "current" | "later";
export type StudentStep = "gateway" | "docs" | "t002" | "t003";

// ลำดับสถานะก่อนช่วงฝึกงาน — ช่วงฝึกงาน (INTERNSHIP_STARTED + ค่าเก่า) ตัดสินด้วย isInternshipStatus
const ORDER = [
  "NOT_SUBMITTED", "APPLYING", "PENDING_GRADE", "APPLICATION_EDITS_REQUIRED", "QUALIFICATION_FAILED",
  "QUALIFIED", "WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED", "DOCS_APPROVED", "REQ_LETTER_ISSUED",
  "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED",
];
const RANGE: Record<"gateway" | "docs", [string, string]> = {
  gateway: ["NOT_SUBMITTED", "QUALIFICATION_FAILED"],
  docs: ["QUALIFIED", "PLACEMENT_LETTER_ISSUED"],
};

/** สถานะไม่รู้จัก → null (ไม่ใส่เครื่องหมาย ดีกว่าบอกผิด) · ยังไม่มีคำร้อง = NOT_SUBMITTED
 *  T002/T003 เท่ากัน: ก่อนช่วงฝึกงาน = later · ช่วงฝึกงาน ผ่านแล้ว = done อื่น ๆ = current */
export function stepState(
  step: StudentStep,
  status?: string | null,
  forms?: { t002?: FormState; t003?: FormState },
): StepState | null {
  const internship = isInternshipStatus(status);
  const i = ORDER.indexOf(status || "NOT_SUBMITTED");
  if (i < 0 && !internship) return null;
  if (step === "t002" || step === "t003") {
    if (!internship) return "later";
    return forms?.[step] === "APPROVED" ? "done" : "current";
  }
  if (internship) return "done";
  const [from, to] = RANGE[step].map((s) => ORDER.indexOf(s));
  return i < from ? "later" : i > to ? "done" : "current";
}
