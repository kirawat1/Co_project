import { test, expect } from "@playwright/test";
import { bangkokDay, todayBangkok, inBangkokDayRange } from "../src/utils/bangkokDate";

// วันที่ในระบบ = วันตามเวลาไทย (เดิมหลายจุดใช้ toISOString = วันตาม UTC → ก่อน 07:00 น. ได้วันของเมื่อวาน)
// เจอจากการสาธิตตอนตี 4: หนังสือขึ้นวันที่ 19 ทั้งที่เป็นวันที่ 20 · ตั้งรอบเปิดรับ "วันนี้" แล้วหน้ายื่นคำร้องยังปิดจนถึง 07:00
const EARLY = new Date("2026-11-19T21:11:00.000Z"); // 04:11 น. วันที่ 20 พ.ย. เวลาไทย

test.describe("วันตามเวลาไทย", () => {
  test("04:11 น. ยังเป็นวันที่ 20 (toISOString ได้ 19)", () => {
    expect(EARLY.toISOString().slice(0, 10)).toBe("2026-11-19");
    expect(bangkokDay(EARLY)).toBe("2026-11-20");
    expect(bangkokDay("2026-11-20T00:00:00.000Z")).toBe("2026-11-20"); // วันที่เก็บเป็นเที่ยงคืน UTC
    expect(bangkokDay("2026-11-19T17:00:00.000Z")).toBe("2026-11-20"); // เที่ยงคืนเวลาไทย
    expect(todayBangkok()).toBe(bangkokDay(new Date()));
  });

  test("ช่วงรับสมัครนับทั้งวัน: เปิดวันนี้ = ยื่นได้ตั้งแต่เที่ยงคืน · วันปิดยื่นได้ถึงสิ้นวัน", () => {
    const start = "2026-11-20T00:00:00.000Z", end = "2027-01-19T00:00:00.000Z";
    expect(inBangkokDayRange(start, end, EARLY)).toBe(true);
    expect(inBangkokDayRange(start, end, new Date("2026-11-19T16:59:00.000Z"))).toBe(false); // 23:59 น. วันที่ 19
    expect(inBangkokDayRange(start, end, new Date("2027-01-19T16:30:00.000Z"))).toBe(true);  // 23:30 น. วันปิด
    expect(inBangkokDayRange(start, end, new Date("2027-01-19T17:00:00.000Z"))).toBe(false); // 00:00 น. วันถัดไป
  });
});
