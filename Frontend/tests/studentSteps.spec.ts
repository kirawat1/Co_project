import { test, expect } from "@playwright/test";
import { stepState, deadlineNeedsAction, afterFormsAction } from "../src/utils/studentSteps";

// เมนูนักศึกษาบอกว่าขั้นไหนผ่านแล้ว / ทำอยู่ / ยังไม่ถึง — ต้องตรงกับลำดับสถานะจริง
test.describe("เครื่องหมายขั้นตอนบนเมนูนักศึกษา", () => {
  test("ผ่านคุณสมบัติ: ยื่นคำร้องผ่านแล้ว · เอกสาร T000 = ขั้นปัจจุบัน · T002/T003 ยังไม่ถึง", () => {
    expect(stepState("gateway", "QUALIFIED")).toBe("done");
    expect(stepState("docs", "QUALIFIED")).toBe("current");
    expect(stepState("t002", "QUALIFIED")).toBe("later");
    expect(stepState("t003", "QUALIFIED")).toBe("later");
  });

  test("ยังไม่ยื่น / ไม่มีคำร้อง / ถูกส่งกลับแก้ = ขั้นยื่นคำร้อง", () => {
    for (const s of [undefined, null, "", "NOT_SUBMITTED", "APPLYING", "APPLICATION_EDITS_REQUIRED", "QUALIFICATION_FAILED"]) {
      expect(stepState("gateway", s)).toBe("current");
      expect(stepState("docs", s)).toBe("later");
    }
  });

  test("หนังสือส่งตัวออกแล้วยังอยู่ขั้นเอกสาร · ช่วงฝึกงาน T002/T003 เท่ากัน ไม่ต่อกัน", () => {
    expect(stepState("docs", "PLACEMENT_LETTER_ISSUED")).toBe("current");
    expect(stepState("docs", "INTERNSHIP_STARTED")).toBe("done");
    expect(stepState("t002", "PLACEMENT_LETTER_ISSUED")).toBe("later");
    expect(stepState("t003", "PLACEMENT_LETTER_ISSUED")).toBe("later");
    expect(stepState("t002", "INTERNSHIP_STARTED", { t002: "NONE", t003: "NONE" })).toBe("current");
    expect(stepState("t003", "INTERNSHIP_STARTED", { t002: "NONE", t003: "NONE" })).toBe("current");
    expect(stepState("t002", "INTERNSHIP_STARTED", { t002: "APPROVED", t003: "NONE" })).toBe("done");
    expect(stepState("t003", "INTERNSHIP_STARTED", { t002: "APPROVED", t003: "NONE" })).toBe("current");
    expect(stepState("t003", "INTERNSHIP_STARTED", { t002: "NONE", t003: "WAITING" })).toBe("current");
    expect(stepState("t002", "INTERNSHIP_STARTED")).toBe("current");
  });

  test("ค่าเก่าในช่วงฝึกงานปฏิบัติเหมือน INTERNSHIP_STARTED", () => {
    expect(stepState("docs", "T002_SUBMITTED")).toBe("done");
    expect(stepState("t002", "T003_APPROVED", { t002: "APPROVED", t003: "APPROVED" })).toBe("done");
    expect(stepState("t003", "T003_APPROVED", { t002: "APPROVED", t003: "APPROVED" })).toBe("done");
    expect(stepState("t003", "T002_EDITS_REQUIRED", { t002: "REJECTED", t003: "NONE" })).toBe("current");
  });

  test("สถานะไม่รู้จัก → ไม่ใส่เครื่องหมาย", () => {
    expect(stepState("docs", "SOMETHING_NEW")).toBeNull();
  });
});

// พบจากการจำลองรอบ 100 คน: นักศึกษาที่ฝึกงานแล้ว (T000 ผ่านไปนานแล้ว) หน้าแรกยังนับถอยหลัง "ปิดรับ T000 → อัปโหลดเอกสารตอนนี้"
test.describe("นับถอยหลังบนหน้าแรก = เฉพาะขั้นที่นักศึกษายังต้องส่ง", () => {
  const none = { t002: "NONE", t003: "NONE" } as const;
  test("ยื่นคำร้อง: ยังไม่ยื่น / ถูกส่งกลับแก้ เท่านั้น", () => {
    for (const s of [undefined, "NOT_SUBMITTED", "APPLICATION_EDITS_REQUIRED"]) expect(deadlineNeedsAction("apply", s, none)).toBe(true);
    for (const s of ["APPLYING", "QUALIFIED", "QUALIFICATION_FAILED", "INTERNSHIP_STARTED"]) expect(deadlineNeedsAction("apply", s, none)).toBe(false);
  });
  test("T000: ผ่านคำร้องแล้วยังไม่ส่ง / ต้องแก้ เท่านั้น — ส่งแล้ว รอตรวจ หรือฝึกงานแล้ว ไม่นับ", () => {
    for (const s of ["QUALIFIED", "EDITS_REQUIRED"]) expect(deadlineNeedsAction("t000", s, none)).toBe(true);
    for (const s of ["APPLYING", "WAITING_FOR_STAFF_CHECK", "DOCS_APPROVED", "REQ_LETTER_ISSUED", "INTERNSHIP_STARTED", "T003_APPROVED"]) expect(deadlineNeedsAction("t000", s, none)).toBe(false);
  });
  test("T002/T003: ช่วงฝึกงาน และฟอร์มนั้นยังไม่ส่ง / ต้องแก้", () => {
    expect(deadlineNeedsAction("t002", "INTERNSHIP_STARTED", { t002: "NONE", t003: "APPROVED" })).toBe(true);
    expect(deadlineNeedsAction("t003", "INTERNSHIP_STARTED", { t002: "NONE", t003: "REJECTED" })).toBe(true);
    expect(deadlineNeedsAction("t002", "INTERNSHIP_STARTED", { t002: "WAITING", t003: "NONE" })).toBe(false);
    expect(deadlineNeedsAction("t003", "INTERNSHIP_STARTED", { t002: "NONE", t003: "APPROVED" })).toBe(false);
    expect(deadlineNeedsAction("t002", "ACCEPTANCE_CHECKED", none)).toBe(false);
  });
});

// พบจากการจำลองรอบ: นิเทศเสร็จแล้ว แถบขั้นตอนถัดไปยังบอก "ไปนัดหมาย"
test.describe("ขั้นถัดไปหลัง T002/T003 ผ่าน ตามสถานะนัดนิเทศ", () => {
  test("ยังไม่นัด / รออาจารย์ = ไปนัดหมาย", () => {
    for (const s of [undefined, null, "PENDING_TEACHER"]) expect(afterFormsAction(s).link).toBe("/student/supervision");
  });
  test("อาจารย์ขอให้เสนอวันใหม่ = ต้องดำเนินการ", () => {
    const a = afterFormsAction("TEACHER_REJECTED");
    expect([a.link, a.isWarning]).toEqual(["/student/supervision", true]);
  });
  test("ยืนยันวันแล้ว = ไม่ชวนไปนัดซ้ำ · นิเทศเสร็จ = ไปส่งเล่ม T008", () => {
    for (const s of ["DATE_CONFIRMED", "LETTER_UPLOADED"]) expect(afterFormsAction(s).text).not.toMatch(/นัดหมายนิเทศสหกิจกับอาจารย์/);
    const done = afterFormsAction("COMPLETED");
    expect(done.link).toBe("/student/doc-t008");
    expect(done.text).toMatch(/นิเทศเสร็จ/);
  });
});
