import { test, expect } from "@playwright/test";
import { defaultReviewPeriod, pendingOutside, periodCountLabel, type PeriodCount } from "../src/utils/reviewStudents";

// ฟังก์ชันล้วน ไม่เปิดเบราว์เซอร์ — รอบเริ่มต้นของหน้าตรวจ T002/T003

const P = [
  { id: 1, semester: 1, academicYear: "2569" },
  { id: 2, semester: 2, academicYear: "2569" }, // ฝึกงานอยู่ (มีงานตรวจ T002/T003)
  { id: 3, semester: 1, academicYear: "2570" }, // รอบหน้า เปิดรับสมัครแล้ว (ยังไม่มีใครถึง T002)
];
const c = (coopPeriodId: number | null, count: number, pending = 0): PeriodCount => ({ coopPeriodId, count, pending });

test.describe("defaultReviewPeriod", () => {
  test("รอบหน้าเปิดแล้วแต่งานตรวจอยู่รอบก่อน → เปิดที่รอบที่มีงานรอตรวจ ไม่ใช่รอบใหม่สุด", () => {
    expect(defaultReviewPeriod(P, [c(2, 40, 5), c(1, 30)])).toBe("2");
  });

  test("มีงานรอตรวจหลายรอบ → รอบล่าสุดที่มีงานรอตรวจ (อีกรอบขึ้นเตือนด้วย pendingOutside)", () => {
    const counts = [c(1, 30, 2), c(2, 40, 5)];
    expect(defaultReviewPeriod(P, counts)).toBe("2");
    expect(pendingOutside(counts, "2")).toBe(2);
  });

  test("ไม่มีงานรอตรวจ → รอบล่าสุดที่มีรายชื่อ", () => {
    expect(defaultReviewPeriod(P, [c(1, 30), c(2, 12)])).toBe("2");
  });

  test("นักศึกษาที่ยังไม่ผูกรอบมีงานรอตรวจ → ทุกปีการศึกษา (เลือกรอบไหนก็ไม่เห็น)", () => {
    expect(defaultReviewPeriod(P, [c(null, 3, 1), c(2, 40, 5)])).toBe("all");
  });

  test("ยังไม่มีใครในรายการ / ไม่มีรอบ → ทุกปีการศึกษา", () => {
    expect(defaultReviewPeriod(P, [])).toBe("all");
    expect(defaultReviewPeriod([], [c(2, 4, 1)])).toBe("all");
  });
});

test.describe("pendingOutside / periodCountLabel", () => {
  test("ดูทุกปีการศึกษาอยู่แล้ว → ไม่ต้องเตือน · นับรวมนักศึกษาที่ยังไม่ผูกรอบ", () => {
    const counts = [c(null, 3, 1), c(1, 30, 2), c(2, 40, 5)];
    expect(pendingOutside(counts, "all")).toBe(0);
    expect(pendingOutside(counts, "2")).toBe(3);
  });

  test("ชื่อรอบใน dropdown บอกจำนวน + รอตรวจ", () => {
    const counts = [c(1, 30), c(2, 40, 5)];
    expect(periodCountLabel(counts, 2)).toBe(" · 40 คน · รอตรวจ 5");
    expect(periodCountLabel(counts, "1")).toBe(" · 30 คน");
    expect(periodCountLabel(counts, 3)).toBe("");
  });
});
