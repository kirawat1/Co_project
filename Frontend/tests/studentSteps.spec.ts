import { test, expect } from "@playwright/test";
import { stepState } from "../src/utils/studentSteps";

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

  test("หนังสือส่งตัวออกแล้วยังอยู่ขั้นเอกสาร · ออกฝึกแล้ว = ขั้น T002", () => {
    expect(stepState("docs", "PLACEMENT_LETTER_ISSUED")).toBe("current");
    expect(stepState("docs", "INTERNSHIP_STARTED")).toBe("done");
    expect(stepState("t002", "INTERNSHIP_STARTED")).toBe("current");
    expect(stepState("t002", "T002_EDITS_REQUIRED")).toBe("current");
  });

  test("ส่ง T002 แล้ว (อนุมัติแล้วสถานะยังเท่าเดิม) → T002 และ T003 เป็นขั้นปัจจุบันทั้งคู่ · T003 ผ่าน = ครบ", () => {
    expect(stepState("t002", "T002_SUBMITTED")).toBe("current");
    expect(stepState("t003", "T002_SUBMITTED")).toBe("current");
    expect(stepState("t002", "T003_SUBMITTED")).toBe("done");
    expect(stepState("t003", "T003_EDITS_REQUIRED")).toBe("current");
    expect(stepState("t003", "T003_APPROVED")).toBe("done");
  });

  test("สถานะไม่รู้จัก → ไม่ใส่เครื่องหมาย", () => {
    expect(stepState("docs", "SOMETHING_NEW")).toBeNull();
  });
});
