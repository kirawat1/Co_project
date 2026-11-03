import { test, expect } from "@playwright/test";
import { t002Reviewable, t002CanSubmit } from "../src/utils/t002Review";

// ตรวจ T002 / ส่ง T002 ใหม่ — ต้องตรงกับ backend/utils/t002Review.js (เทสต์ฝั่ง server: __tests__/t002Review.test.js)
test.describe("ตรวจ T002 ได้เมื่อไหร่", () => {
  test("ส่ง T002 แล้ว (ยังไม่ส่ง T003) → ตรวจได้ทั้งตอนรอตรวจและหลังผ่าน (เปลี่ยนใจก่อนส่ง T003)", () => {
    expect(t002Reviewable("T002_SUBMITTED", "WAITING")).toBe(true);
    expect(t002Reviewable("T002_SUBMITTED", "APPROVED")).toBe(true);
  });

  test("ส่ง T003 ไปก่อน T002 ถูกตรวจ → ตรวจย้อนหลังได้จนกว่าไฟล์จะถูกตรวจ", () => {
    for (const s of ["T003_SUBMITTED", "T003_EDITS_REQUIRED", "T003_APPROVED"]) {
      expect(t002Reviewable(s, "WAITING")).toBe(true);
      expect(t002Reviewable(s, "APPROVED")).toBe(false);
      expect(t002Reviewable(s, "REJECTED")).toBe(false); // รอนักศึกษาส่งใหม่
    }
  });

  test("รอนักศึกษาแก้ · ยังไม่ส่ง · ไม่มีไฟล์ → ตรวจไม่ได้", () => {
    expect(t002Reviewable("T002_EDITS_REQUIRED", "REJECTED")).toBe(false);
    expect(t002Reviewable("INTERNSHIP_STARTED", undefined)).toBe(false);
    expect(t002Reviewable("T002_SUBMITTED", undefined)).toBe(false);
  });
});

test.describe("นักศึกษาส่ง T002 ได้เมื่อไหร่", () => {
  test("เริ่มฝึก · ถูกตีกลับ · ถูกตีกลับย้อนหลังตอนอยู่ขั้น T003", () => {
    expect(t002CanSubmit("INTERNSHIP_STARTED", undefined)).toBe(true);
    expect(t002CanSubmit("T002_EDITS_REQUIRED", "REJECTED")).toBe(true);
    expect(t002CanSubmit("T003_SUBMITTED", "REJECTED")).toBe(true);
  });

  test("รอตรวจ/ผ่านแล้ว/ยังไม่ถึงขั้น → ส่งไม่ได้", () => {
    expect(t002CanSubmit("T002_SUBMITTED", "WAITING")).toBe(false);
    expect(t002CanSubmit("T003_SUBMITTED", "WAITING")).toBe(false);
    expect(t002CanSubmit("T003_APPROVED", "APPROVED")).toBe(false);
    expect(t002CanSubmit("PLACEMENT_LETTER_ISSUED", undefined)).toBe(false);
  });
});
