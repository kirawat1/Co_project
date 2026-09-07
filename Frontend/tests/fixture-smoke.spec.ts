import { test, expect } from "@playwright/test";
import {
  assertBackendUp,
  seedLifecycleFixture,
  cleanupLifecycleFixture,
  disconnectSeed,
  getCoopStatus,
} from "./helpers/e2eSeed";

test("fixture smoke: seed + read + cleanup", async () => {
  await assertBackendUp();
  const fx = await seedLifecycleFixture();
  try {
    expect(fx.student.studentPk).toBeGreaterThan(0);
    expect(fx.teacher.teacherPk).toBeGreaterThan(0);
    expect(fx.periodId).toBeGreaterThan(0);
    // สภาพตั้งต้น: เลือกบริษัทไว้แล้ว (หน้า Gateway บังคับ) แต่ยังไม่ยื่นคำร้อง
    expect(await getCoopStatus(fx.student.studentPk)).toBe("NOT_SUBMITTED");
  } finally {
    await cleanupLifecycleFixture(fx);
    await disconnectSeed();
  }
});
