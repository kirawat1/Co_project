import { test, expect } from "@playwright/test";
import { groupYears, yearOptionLabel } from "../src/utils/announcements";

// หน้าประกาศ (เจ้าหน้าที่/อาจารย์): เลือกรอบจากรายการเลื่อนลง จัดกลุ่มตามปีการศึกษา — รอบสะสมหลายปีก็ไม่รก
test.describe("ประกาศ — รายการรอบ", () => {
  test("groupYears: กลุ่มปีใหม่สุดก่อน · ในปีเทอมมากก่อน · ไม่ซ้ำ · ลำดับเข้าไม่เรียงก็ได้", () => {
    expect(groupYears(["1/2568", "2/2569", "2/2568", "1/2569", "2/2569", "3/2568"])).toEqual([
      ["2569", ["2/2569", "1/2569"]],
      ["2568", ["3/2568", "2/2568", "1/2568"]],
    ]);
    expect(groupYears([])).toEqual([]);
  });

  test("yearOptionLabel: แบบเดียวกับตัวเลือกรอบหน้าอื่น", () => {
    expect(yearOptionLabel("2/2569")).toBe("เทอม 2 / 2569");
  });
});
