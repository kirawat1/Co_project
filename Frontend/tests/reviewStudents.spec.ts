import { test, expect } from "@playwright/test";
import { pendingOutside, periodCountLabel, type PeriodCount } from "../src/utils/reviewStudents";
import { defaultPeriodId } from "../src/utils/defaultPeriod";

// ฟังก์ชันล้วน ไม่เปิดเบราว์เซอร์ — รอบเริ่มต้นของทุกหน้า (รอบที่เปิดอยู่) + จำนวนรอตรวจต่อรอบ

test.describe("defaultPeriodId — รอบที่เปิดอยู่", () => {
  const p = (id: number, semester: number, academicYear: string, isActive = false) => ({ id, semester, academicYear, isActive });

  test("เปิดรอบเดียว → รอบนั้น แม้มีรอบใหม่กว่าที่ยังไม่เปิด", () => {
    expect(defaultPeriodId([p(1, 1, "2569"), p(2, 2, "2569", true), p(3, 1, "2570")])).toBe("2");
  });
  test("เปิดหลายรอบ → รอบใหม่สุดที่เปิด (ไม่ขึ้นกับลำดับที่ API ส่งมา)", () => {
    expect(defaultPeriodId([p(2, 2, "2569", true), p(1, 1, "2569", true), p(3, 1, "2570")])).toBe("2");
  });
  test("ไม่มีรอบเปิด → รอบใหม่สุด · ไม่มีรอบเลย → ทุกปีการศึกษา", () => {
    expect(defaultPeriodId([p(1, 2, "2569"), p(3, 1, "2570"), p(2, 1, "2569")])).toBe("3");
    expect(defaultPeriodId([])).toBe("all");
  });
});

const c = (coopPeriodId: number | null, count: number, pending = 0): PeriodCount => ({ coopPeriodId, count, pending });

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
