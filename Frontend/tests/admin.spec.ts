/**
 * tests/admin.spec.ts
 * ─────────────────────────────────────────────────────
 * Playwright UI tests — Admin/Staff role (/admin/*)
 */

import { test, expect } from "@playwright/test";
import {
  setupAdminMocks,
  assertTopbarVisible,
  assertNotRedirectedToLogin,
} from "./helpers/mockApi";

const ADMIN_ROUTES = [
  { path: "/admin/dashboard",           label: "TC-A-01: Dashboard หน้าหลัก Admin" },
  { path: "/admin/students",            label: "TC-A-02: หน้าจัดการนักศึกษา" },
  { path: "/admin/mentors",             label: "TC-A-03: หน้าจัดการพี่เลี้ยง" },
  { path: "/admin/company",             label: "TC-A-04: หน้าจัดการบริษัท" },
  { path: "/admin/docs",                label: "TC-A-05: หน้าเอกสาร" },
  { path: "/admin/daily",               label: "TC-A-06: หน้าบันทึกประจำวัน Admin" },
  { path: "/admin/announcements",       label: "TC-A-07: หน้าประกาศข่าวสาร" },
  { path: "/admin/settings",            label: "TC-A-08: หน้าตั้งค่า" },
  { path: "/admin/teachers",            label: "TC-A-09: หน้าจัดการอาจารย์" },
  { path: "/admin/criteria",            label: "TC-A-10: หน้าเกณฑ์คะแนน" },
  { path: "/admin/doct000",             label: "TC-A-11: เอกสาร T000" },
  { path: "/admin/doct002",             label: "TC-A-12: ตรวจ T002" },
  { path: "/admin/doct003",             label: "TC-A-13: ตรวจ T003" },
  { path: "/admin/coop-period",         label: "TC-A-14: จัดการรอบสหกิจ" },
  { path: "/admin/coop-applications",   label: "TC-A-15: จัดการใบสมัครสหกิจ" },
  { path: "/admin/supervision-manager", label: "TC-A-16: จัดการการนิเทศ" },
  { path: "/admin/doc-t005-006",        label: "TC-A-17: เอกสาร T005/T006 Admin" },
  { path: "/admin/doc-t007",            label: "TC-A-18: เอกสาร T007 Admin" },
  { path: "/admin/doc-t008",            label: "TC-A-19: เอกสาร T008 Admin" },
  { path: "/admin/doc-requirements",    label: "TC-A-20: ข้อกำหนดเอกสาร" },
];

// ── TC-A-00: /admin → redirect ──
test("TC-A-00: /admin/ redirects to /admin/dashboard", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin");
  await page.waitForURL("**/admin/dashboard", { timeout: 10_000 });
  await assertTopbarVisible(page);
});

// ── Loop ทดสอบแต่ละหน้า ──
for (const { path, label } of ADMIN_ROUTES) {
  test(`${label} — โหลดได้ไม่ redirect`, async ({ page }) => {
    await setupAdminMocks(page);
    await page.goto(path);
    await assertTopbarVisible(page);
    await assertNotRedirectedToLogin(page);
    expect(page.url()).toContain("/admin/");
  });
}

// ── TC-A-21: ไม่มี token → redirect ──
test("TC-A-21: ไม่มี token → redirect ไปหน้า login", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await page.waitForURL(/localhost:5173\/?$/, { timeout: 10_000 });
  expect(page.url()).toMatch(/localhost:5173\/?$/);
});

// ── TC-A-22: Topbar แสดง email admin ──
test("TC-A-22: Topbar แสดงชื่อ/email ของ admin", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin/dashboard");
  await assertTopbarVisible(page);
  const userNameEl = page.locator(".user-name");
  await expect(userNameEl).toBeVisible();
  const text = await userNameEl.innerText();
  expect(text.trim().length).toBeGreaterThan(0);
});

// ── TC-A-23: Students มี content ──
test("TC-A-23: หน้า Students มี element แสดงผล", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin/students");
  await assertTopbarVisible(page);
  const main = page.locator("main");
  await expect(main).toBeVisible();
});

// ── TC-A-24: ปุ่ม Logout ──
test("TC-A-24: ปุ่ม Logout แสดงอยู่ใน topbar", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin/dashboard");
  await assertTopbarVisible(page);
  const logoutBtn = page.locator('button[aria-label="ออกจากระบบ"]');
  await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
});

// ── TC-A-25: โลโก้ Co-op ──
test("TC-A-25: โลโก้ Co-op แสดงใน topbar", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin/dashboard");
  await assertTopbarVisible(page);
  const logo = page.locator('img[alt="Co-op Logo"]');
  await expect(logo).toBeVisible();
});

// ── TC-A-26: URL ไม่ถูกต้อง → redirect ──
test("TC-A-26: URL ไม่ถูกต้อง → redirect ไป /admin/dashboard", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin/nonexistent-page");
  await page.waitForURL("**/admin/dashboard", { timeout: 10_000 });
});
