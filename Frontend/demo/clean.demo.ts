// ล้างข้อมูลสาธิตทั้งหมด (บัญชี demo.* · หลักสูตร DEMO · รอบที่ demo สร้าง · ไฟล์ที่อัปโหลด) — ไม่เปิดเบราว์เซอร์
import { test } from "@playwright/test";
import { resetDemo, prisma } from "./data";

test("ล้างข้อมูลสาธิต", async () => {
  const r = await resetDemo();
  console.log(`ลบข้อมูลสาธิตแล้ว: ผู้ใช้ ${r.users} บัญชี · นักศึกษา ${r.students} คน`);
  await prisma.$disconnect();
});
