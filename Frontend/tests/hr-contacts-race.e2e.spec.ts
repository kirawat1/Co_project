/**
 * tests/hr-contacts-race.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * Regression: หน้าข้อมูลนักศึกษา — เอาผู้ติดต่อ (HR) ออก 2 คนพร้อมกันเร็วมาก (native double-click
 * ในติ๊กเดียวกัน) แล้วต้องบันทึกครบทั้งสองการลบ ไม่ใช่ "คนที่กดก่อนกลับมา" (last-handler-wins)
 *
 * ที่มา: S_ProfilePage.tsx เดิมสร้าง "ค่าถัดไป" จากตัวแปร `selectedContacts` ที่ปิดล้อมไว้ตอน render
 * ถ้า handler ของปุ่มลบสองปุ่มยิงในติ๊กเดียวกันก่อน React re-render ทัน ทั้งสอง handler จะเริ่มจาก
 * รายการเก่าชุดเดียวกัน — handler หลังคำนวณทับ handler แรก การลบของ handler แรกจึงหายไป
 * แก้ด้วย companyRef (ref แบบ synchronous) ให้ handler ที่สองอ่านผลของ handler แรกได้ทัน
 *
 * บั๊กนี้ยืนยันไม่ได้ด้วย Playwright .click() ธรรมดา (แม้ผ่าน Promise.all ก็ไม่ synchronous จริง
 * เพราะมีการ round-trip ผ่าน CDP หลายจังหวะ) ต้อง dispatch click สองครั้งในบราวเซอร์เอง
 * (page.evaluate) ถึงจะได้ "สองปุ่มยิงในติ๊กเดียวกัน" ตามที่โค้ดจริงต้องรับมือ
 *
 * ต้องการ: backend รันอยู่ที่ http://localhost:5000, MySQL เข้าถึงได้ (เหมือน coop-lifecycle.e2e.spec.ts)
 */
import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");

const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const bcrypt = require(path.join(BACKEND_DIR, "node_modules/bcryptjs"));

const E2E_PASSWORD = "E2eTest#1234";

let studentUserId: number;
let studentPk: number;
let companyId: string;
let contactAId: string;
let contactBId: string;

test.beforeAll(async () => {
  const stamp = Date.now();
  const hash = await bcrypt.hash(E2E_PASSWORD, 10);
  const tag = `e2e${stamp}`;

  const studentUser = await prisma.user.create({
    data: { username: `zz-${tag}-hrrace`, email: `zz-${tag}-hrrace@kkumail.com`, password: hash, role: "student" },
  });
  studentUserId = studentUser.id;
  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      studentId: `91${String(stamp).slice(-8)}`,
      prefix: "MR", firstName: "เรซ", lastName: "ทดสอบ",
      email: studentUser.email, major: "CS", year: "4", studyProgram: "normal",
    },
  });
  studentPk = student.id;

  const company = await prisma.company.create({
    data: { name: `ZZ-E2E บริษัทเรซ ${stamp}`, province: "ขอนแก่น", phone: "0800000009", pastYears: "2569", createdById: studentUser.id },
  });
  companyId = company.id;

  const [a, b] = await Promise.all([
    prisma.companyContact.create({ data: { firstName: "REPRO-RACE-A", lastName: "x", companyId: company.id } }),
    prisma.companyContact.create({ data: { firstName: "REPRO-RACE-B", lastName: "x", companyId: company.id } }),
  ]);
  contactAId = a.id; contactBId = b.id;

  await prisma.studentCoop.create({
    data: { studentId: student.id, status: "NOT_SUBMITTED", companyId: company.id, contacts: { connect: [{ id: a.id }, { id: b.id }] } },
  });
});

test.afterAll(async () => {
  await prisma.studentCoop.deleteMany({ where: { studentId: studentPk } });
  await prisma.companyContact.deleteMany({ where: { companyId } });
  await prisma.student.deleteMany({ where: { id: studentPk } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.user.deleteMany({ where: { id: studentUserId } });
  await prisma.$disconnect();
});

test("เอาผู้ติดต่อ (HR) ออก 2 คนพร้อมกันในติ๊กเดียวกัน → บันทึกครบทั้งสอง ไม่มีคนไหนกลับมา", async ({ page }) => {
  const errors: string[] = [];
  const dialogs: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });

  await page.goto("/");
  await page.getByRole("button", { name: "นักศึกษา", exact: true }).click();
  const studentEmail = (await prisma.user.findUnique({ where: { id: studentUserId }, select: { email: true } })).email;
  await page.getByRole("textbox", { name: "ชื่อผู้ใช้ (Username)" }).fill(studentEmail);
  await page.getByRole("textbox", { name: "รหัสผ่าน" }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForURL("**/student/dashboard", { timeout: 15_000 });

  await page.goto("/student/profile");
  await page.locator(".contact-chip", { hasText: "REPRO-RACE-A" }).waitFor({ timeout: 15_000 });
  await page.locator(".contact-chip", { hasText: "REPRO-RACE-B" }).waitFor({ timeout: 5_000 });

  // native double-click จริง — สอง handler ยิงในติ๊กเดียวกัน (สิ่งที่ Playwright .click() x2 จำลองไม่ได้)
  const dispatched = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>(".contact-chip button"));
    const a = btns.find((b) => b.closest(".contact-chip")?.textContent?.includes("REPRO-RACE-A"));
    const b = btns.find((b) => b.closest(".contact-chip")?.textContent?.includes("REPRO-RACE-B"));
    if (!a || !b) return false;
    a.click();
    b.click();
    return true;
  });
  expect(dispatched).toBe(true);

  await expect(page.locator(".contact-chip")).toHaveCount(0, { timeout: 10_000 });
  await page.getByText("✓ บันทึกแล้ว").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500); // ให้คิวบันทึก (saveChain) รันจบทั้งสองคำขอ

  const coop = await prisma.studentCoop.findUnique({ where: { studentId: studentPk }, include: { contacts: true } });
  expect(coop.contacts.map((c: { id: string }) => c.id).sort()).toEqual([]);
  expect(errors).toHaveLength(0);
  expect(dialogs).toHaveLength(0);
});
