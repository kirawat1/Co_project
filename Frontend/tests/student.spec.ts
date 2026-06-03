/**
 * tests/student.spec.ts
 * ─────────────────────────────────────────────────────
 * Playwright UI tests — Student role (/student/*)
 * ─────────────────────────────────────────────────────
 * ข้อกำหนด:
 *   - dev server ต้องรันที่ http://localhost:5173 ก่อน
 *   - ไม่ทดสอบกระบวนการ login
 *   - mock API ทุก endpoint เพื่อไม่ต้องพึ่ง backend จริง
 */

import { test, expect } from "@playwright/test";
import {
  setupStudentMocks,
  assertTopbarVisible,
  assertNotRedirectedToLogin,
} from "./helpers/mockApi";

const STUDENT_ROUTES = [
  { path: "/student/dashboard",      label: "TC-S-01: Dashboard หน้าหลัก" },
  { path: "/student/profile",        label: "TC-S-02: หน้าโปรไฟล์นักศึกษา" },
  { path: "/student/gateway",        label: "TC-S-03: หน้า Gateway (สมัครสหกิจ)" },
  { path: "/student/daily",          label: "TC-S-04: หน้าบันทึกประจำวัน" },
  { path: "/student/docs",           label: "TC-S-05: หน้าเอกสาร" },
  { path: "/student/company",        label: "TC-S-06: หน้าข้อมูลบริษัท" },
  { path: "/student/docs-t002",      label: "TC-S-07: ฟอร์มเอกสาร T002" },
  { path: "/student/docs-t003",      label: "TC-S-08: ฟอร์มเอกสาร T003" },
  { path: "/student/supervision",    label: "TC-S-09: หน้านิเทศ" },
  { path: "/student/status-tracker", label: "TC-S-10: หน้า Status Tracker" },
  { path: "/student/doc-t005-006",   label: "TC-S-11: เอกสาร T005/T006" },
  { path: "/student/doc-t007",       label: "TC-S-12: เอกสาร T007" },
  { path: "/student/doc-t008",       label: "TC-S-13: เอกสาร T008" },
];

// ── TC-S-00: /student/ redirect ──
test("TC-S-00: /student/ redirects to /student/dashboard", async ({ page }) => {
  await setupStudentMocks(page);
  await page.goto("/student/");
  await page.waitForURL("**/student/dashboard", { timeout: 10_000 });
  await assertTopbarVisible(page);
});

// ── Loop ทดสอบแต่ละหน้า ──
for (const { path, label } of STUDENT_ROUTES) {
  test(`${label} — โหลดได้ไม่ redirect`, async ({ page }) => {
    await setupStudentMocks(page);
    await page.goto(path);
    await assertTopbarVisible(page);
    await assertNotRedirectedToLogin(page);
    expect(page.url()).toContain("/student/");
  });
}

// ── TC-S-14: Sidebar แสดงขึ้นเมื่อกด hamburger ──
// NOTE: hamburger เป็น mobile-only (display:none บน desktop ตาม S_Theme CSS)
// → ต้องตั้ง viewport เป็น mobile (≤768px) เพื่อให้ปุ่มมองเห็นได้
test("TC-S-14: Sidebar แสดงขึ้นเมื่อกด hamburger menu", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await setupStudentMocks(page);
  await page.goto("/student/dashboard");
  await assertTopbarVisible(page);
  const hamburger = page.locator('button[aria-label="เมนู"]').first();
  await hamburger.click();
  // ตรวจว่า sidebar element มี class "open"
  const sidebar = page.locator("aside.sidebar");
  await expect(sidebar).toHaveClass(/open/, { timeout: 5_000 });
});

// ── TC-S-15: ปุ่ม Logout ใน topbar ──
test("TC-S-15: ปุ่ม Logout แสดงอยู่ใน topbar", async ({ page }) => {
  await setupStudentMocks(page);
  await page.goto("/student/dashboard");
  await assertTopbarVisible(page);
  const logoutBtn = page.locator('button[aria-label="ออกจากระบบ"]');
  await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
});

// ── TC-S-16: ไม่มี token → redirect ──
test("TC-S-16: ไม่มี token → redirect ไปหน้า login", async ({ page }) => {
  // ไม่ inject token
  await page.goto("/student/dashboard");
  await page.waitForURL(/localhost:5173\/?$/, { timeout: 10_000 });
  expect(page.url()).toMatch(/localhost:5173\/?$/);
});

// ── TC-S-17: หน้า Daily มี main content ──
test("TC-S-17: หน้า Daily มี section เนื้อหา", async ({ page }) => {
  await setupStudentMocks(page);
  await page.goto("/student/daily");
  await assertTopbarVisible(page);
  const main = page.locator("main");
  await expect(main).toBeVisible();
});

// ── TC-S-18: โลโก้ Co-op ──
test("TC-S-18: โลโก้ Co-op แสดงใน topbar", async ({ page }) => {
  await setupStudentMocks(page);
  await page.goto("/student/dashboard");
  await assertTopbarVisible(page);
  const logo = page.locator('img[alt="Co-op Logo"]');
  await expect(logo).toBeVisible();
});
