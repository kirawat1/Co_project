// เครื่องหมายขั้นตอนบนเมนูนักศึกษา — ✓ ผ่านแล้ว / ● ขั้นปัจจุบัน / จาง = ยังไม่ถึง
// เฉพาะขั้นที่บอกได้จากสถานะคำร้องอย่างเดียว (นิเทศ/T005–T008 ไม่มีสถานะของตัวเอง จึงไม่ใส่เครื่องหมาย)
import { isInternshipStatus, FORMS_DONE_LABEL, type FormState } from "./internshipForms";

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

// ═════════ หน้าแรกนักศึกษา ═════════

export type DeadlineStep = "apply" | "t000" | "t002" | "t003";
const T000_TODO = ["QUALIFIED", "EDITS_REQUIRED"];

/** ขั้นนี้ยังเป็นงานที่นักศึกษาต้องส่งอยู่ไหม — กล่องนับถอยหลัง "→ อัปโหลดเอกสารตอนนี้" นับเฉพาะขั้นแบบนี้
 *  (เดิมนับทุกขั้นที่เปิดรับอยู่: นักศึกษาที่ฝึกงานแล้วเห็น "ปิดรับ T000" ชวนให้ส่ง T000 ซ้ำ) */
export function deadlineNeedsAction(step: DeadlineStep, status: string | null | undefined, forms: { t002: FormState; t003: FormState }): boolean {
  const st = status || "NOT_SUBMITTED";
  if (step === "apply") return st === "NOT_SUBMITTED" || st === "APPLICATION_EDITS_REQUIRED";
  if (step === "t000") return T000_TODO.includes(st);
  return isInternshipStatus(st) && (forms[step] === "NONE" || forms[step] === "REJECTED");
}

export interface NextAction { text: string; link?: string; linkText?: string; isWarning?: boolean }

/** ขั้นถัดไปเมื่อ T002/T003 ผ่านครบแล้ว — ตามสถานะนัดนิเทศ (เดิมบอก "ไปนัดหมาย" ตลอด แม้นิเทศเสร็จแล้ว) */
export function afterFormsAction(supervisionStatus?: string | null): NextAction {
  const done = FORMS_DONE_LABEL;
  switch (supervisionStatus) {
    case "TEACHER_REJECTED":
      return { text: `${done} — อาจารย์ขอให้เสนอวันนิเทศใหม่`, link: "/student/supervision", linkText: "เสนอวันใหม่", isWarning: true };
    case "DATE_CONFIRMED":
    case "LETTER_UPLOADED":
      return { text: `${done} — อาจารย์ยืนยันวันนิเทศแล้ว เตรียมรับการนิเทศ และเตรียมส่งเล่มรายงาน T008`, link: "/student/supervision", linkText: "ดูวันนิเทศ" };
    case "COMPLETED":
      return { text: "นิเทศเสร็จแล้ว — ส่งแบบประเมิน T005–T007 และเล่มรายงาน T008", link: "/student/doc-t008", linkText: "ไปส่งเล่ม T008" };
    default:
      return { text: `${done} — นัดหมายนิเทศสหกิจกับอาจารย์ และเตรียมส่งเล่มรายงาน T008`, link: "/student/supervision", linkText: "ไปนัดหมาย" };
  }
}
